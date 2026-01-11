import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type AadTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

@Injectable()
export class PowerBiService {
  private cachedAadToken?: { token: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  private get tenantId() { return this.config.get<string>('PBI_TENANT_ID'); }
  private get clientId() { return this.config.get<string>('PBI_CLIENT_ID'); }
  private get clientSecret() { return this.config.get<string>('PBI_CLIENT_SECRET'); }

  // 1) Obter token do Entra (client credentials)
  private async getAadAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedAadToken && now < this.cachedAadToken.expiresAt - 60_000) {
      return this.cachedAadToken.token;
    }

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId ?? '',
      client_secret: this.clientSecret ?? '',
      scope: 'https://analysis.windows.net/powerbi/api/.default',
    });

    try {
      const res = await axios.post<AadTokenResponse>(url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const token = res.data.access_token;
      const expiresInMs = res.data.expires_in * 1000;
      this.cachedAadToken = { token, expiresAt: now + expiresInMs };

      return token;
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Falha ao obter token Entra: ${err?.response?.status} ${JSON.stringify(err?.response?.data)}`
      );
    }
  }

  private async pbiGet<T>(path: string): Promise<T> {
    const aad = await this.getAadAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg${path}`;
    const res = await axios.get<T>(url, {
      headers: { Authorization: `Bearer ${aad}` },
    });
    return res.data;
  }

  private async pbiPost<T>(path: string, payload: any): Promise<T> {
    const aad = await this.getAadAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg${path}`;
    const res = await axios.post<T>(url, payload, {
      headers: { Authorization: `Bearer ${aad}` },
    });
    return res.data;
  }

  async refreshDatasetInGroup(workspaceId: string, datasetId: string) {
    return this.pbiPost<any>(`/groups/${workspaceId}/datasets/${datasetId}/refreshes`, {});
  }

  async listDatasetRefreshesInGroup(workspaceId: string, datasetId: string) {
    const res = await this.pbiGet<{ value: any[] }>(
      `/groups/${workspaceId}/datasets/${datasetId}/refreshes?$top=10`
    );
    return res.value ?? [];
  }

  async listWorkspaces() {
    const res = await this.pbiGet<{ value: any[] }>(`/groups`);
    return res.value.map(g => ({
        id: g.id,
        name: g.name,
        isReadOnly: g.isReadOnly,
        type: g.type,
    }));
    }

  async listReports(workspaceId: string) {
    const res = await this.pbiGet<{ value: any[] }>(`/groups/${workspaceId}/reports`);
    return res.value.map(r => ({
        workspaceId,
        id: r.id,
        name: r.name,
        datasetId: r.datasetId,
        embedUrl: r.embedUrl,
    }));
    }

  // 2) Gerar embed config para um report (workspace + report)
  async getEmbedConfig(
    workspaceId: string,
    reportId: string,
    opts?: { username: string; roles?: string[]; customData?: string; forceIdentity?: boolean },
  ) {
    // 2.1 Buscar metadados do relatório para pegar embedUrl e datasetId
    // GET /groups/{groupId}/reports/{reportId}
    const report = await this.pbiGet<any>(`/groups/${workspaceId}/reports/${reportId}`);

    const embedUrl = report?.embedUrl;
    const datasetId = report?.datasetId;

    if (!embedUrl || !datasetId) {
      throw new InternalServerErrorException(
        `Report sem embedUrl/datasetId. Resposta: ${JSON.stringify(report)}`
      );
    }

    // 2.2 Gerar embed token
    // POST /GenerateToken
    const tokenPayload: any = {
      reports: [{ id: reportId }],
      datasets: [{ id: datasetId }],
      targetWorkspaces: [{ id: workspaceId }],
    };

    if (opts?.username) {
      let includeIdentity = opts.forceIdentity === true;
      let roles = opts.roles ?? [];

      if (!includeIdentity) {
        try {
          const ds = await this.pbiGet<any>(`/groups/${workspaceId}/datasets/${datasetId}`);
          const requiresIdentity = !!ds?.isEffectiveIdentityRequired;
          const requiresRoles = !!ds?.isEffectiveIdentityRolesRequired;
          includeIdentity = requiresIdentity || requiresRoles;
          if (!requiresRoles) roles = [];
        } catch (_err: any) {
          includeIdentity = true;
        }
      }

      if (includeIdentity) {
        tokenPayload.identities = [
          {
            username: opts.username,
            roles,
            datasets: [datasetId],
            customData: opts.customData,
          },
        ];
      }
    }

    let tokenRes: any;
    try {
      tokenRes = await this.pbiPost<any>(`/GenerateToken`, tokenPayload);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      throw new InternalServerErrorException(
        `Falha ao gerar embed token: ${status ?? 'unknown'} ${JSON.stringify(data ?? {})}`
      );
    }

    const embedToken = tokenRes?.token;
    const expiresOn = tokenRes?.expiration;

    if (!embedToken) {
      throw new InternalServerErrorException(
        `Falha ao gerar embed token: ${JSON.stringify(tokenRes)}`
      );
    }

    return {
      reportId,
      workspaceId,
      embedUrl,
      embedToken,
      expiresOn,
    };
  }
}
