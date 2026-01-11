import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type AadTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type PbiExportResponse = {
  id?: string;
  status?: string;
};

type PbiExportStatus = {
  id?: string;
  status?: 'NotStarted' | 'Running' | 'Succeeded' | 'Failed';
  percentComplete?: number;
  error?: { code?: string; message?: string };
};

type ExportFormat = 'PDF' | 'PNG';
type ExportKind = 'pdf' | 'png' | 'zip';

type EffectiveIdentity = {
  username: string;
  roles?: string[];
  datasets: string[];
  customData?: string;
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

  private async pbiGetBinary(path: string): Promise<ArrayBuffer> {
    const aad = await this.getAadAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg${path}`;
    const res = await axios.get<ArrayBuffer>(url, {
      headers: { Authorization: `Bearer ${aad}` },
      responseType: 'arraybuffer',
    });
    return res.data;
  }

  private async resolveEffectiveIdentity(
    workspaceId: string,
    datasetId: string,
    opts?: { username?: string; roles?: string[]; customData?: string; forceIdentity?: boolean },
  ): Promise<EffectiveIdentity | null> {
    if (!opts?.username) return null;

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

    if (!includeIdentity) return null;

    return {
      username: opts.username,
      roles,
      datasets: [datasetId],
      customData: opts.customData,
    };
  }

  private async waitForExport(
    workspaceId: string,
    reportId: string,
    exportId: string,
    timeoutMs = 180_000,
    intervalMs = 3_000,
  ): Promise<PbiExportStatus> {
    const startedAt = Date.now();
    let lastStatus: PbiExportStatus | undefined;

    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.pbiGet<PbiExportStatus>(
        `/groups/${workspaceId}/reports/${reportId}/exports/${exportId}`,
      );
      lastStatus = status;

      if (status?.status === 'Succeeded') return status;
      if (status?.status === 'Failed') {
        const code = status?.error?.code;
        const message = status?.error?.message ?? 'Export failed';
        const suffix = code ? `${code} - ${message}` : message;
        throw new InternalServerErrorException(`Falha ao exportar PDF: ${suffix}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const percent =
      typeof lastStatus?.percentComplete === 'number'
        ? ` (${lastStatus.percentComplete}%)`
        : '';
    throw new InternalServerErrorException(
      `Timeout ao exportar PDF. Status atual: ${lastStatus?.status ?? 'unknown'}${percent}`,
    );
  }

  private async stampPdfTitle(pdfBytes: ArrayBuffer, title: string): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 28;
    const paddingX = 24;
    const paddingY = 18;

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      const headerHeight = fontSize + paddingY * 1.2;
      const headerBottom = height - headerHeight;
      const textY = headerBottom + (headerHeight - fontSize) / 2;

      page.drawRectangle({
        x: 0,
        y: headerBottom,
        width,
        height: headerHeight,
        color: rgb(1, 1, 1),
      });

      page.drawText(title, {
        x: paddingX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    return pdfDoc.save();
  }

  private isPdfBuffer(buffer: Buffer, relaxed = false): boolean {
    if (buffer.length < 5) return false;
    if (!relaxed) return buffer.slice(0, 5).toString('utf8') === '%PDF-';

    const max = Math.min(buffer.length, 1024);
    return buffer.slice(0, max).includes(Buffer.from('%PDF-'));
  }

  private isPngBuffer(buffer: Buffer): boolean {
    if (buffer.length < 8) return false;
    return buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  private isZipBuffer(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    const sig = buffer.slice(0, 4);
    return sig.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || sig.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  }

  private describeInvalidPdf(buffer: Buffer): string {
    const prefix = buffer.slice(0, 16).toString('hex');
    return `Export retornou bytes invalidos (prefixo: ${prefix || 'vazio'})`;
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

  async exportReportFile(
    workspaceId: string,
    reportId: string,
    opts?: {
      username?: string;
      roles?: string[];
      customData?: string;
      bookmarkState?: string;
      title?: string;
      forceIdentity?: boolean;
      format?: ExportFormat;
      pageName?: string;
      skipStamp?: boolean;
      relaxedPdfCheck?: boolean;
    },
  ): Promise<{ buffer: Buffer; kind: ExportKind }> {
    const report = await this.pbiGet<any>(`/groups/${workspaceId}/reports/${reportId}`);
    const datasetId = report?.datasetId;

    if (!datasetId) {
      throw new InternalServerErrorException(
        `Report sem datasetId. Resposta: ${JSON.stringify(report)}`
      );
    }

    const format = (opts?.format ?? 'PDF').toUpperCase() as ExportFormat;
    const payload: any = { format };
    const identity = await this.resolveEffectiveIdentity(workspaceId, datasetId, opts);

    if (identity || opts?.bookmarkState || opts?.pageName) {
      payload.powerBIReportConfiguration = {};
      if (identity) {
        payload.powerBIReportConfiguration.identities = [identity];
      }
      if (opts?.bookmarkState) {
        payload.powerBIReportConfiguration.defaultBookmark = { state: opts.bookmarkState };
      }
      if (opts?.pageName) {
        payload.powerBIReportConfiguration.pages = [{ pageName: opts.pageName }];
      }
    }

    let exportRes: PbiExportResponse;
    try {
      exportRes = await this.pbiPost<PbiExportResponse>(
        `/groups/${workspaceId}/reports/${reportId}/ExportTo`,
        payload,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const code = data?.error?.code;
      const message = data?.error?.message ?? data?.message ?? JSON.stringify(data ?? {});
      const suffix = code ? `${code} - ${message}` : message;
      throw new InternalServerErrorException(
        `Falha ao iniciar exportacao PDF: ${status ?? 'unknown'} ${suffix}`
      );
    }

    const exportId = exportRes?.id;
    if (!exportId) {
      throw new InternalServerErrorException(
        `Falha ao iniciar exportacao PDF: ${JSON.stringify(exportRes)}`
      );
    }

    await this.waitForExport(workspaceId, reportId, exportId);
    let fileBytes: ArrayBuffer;
    try {
      fileBytes = await this.pbiGetBinary(
        `/groups/${workspaceId}/reports/${reportId}/exports/${exportId}/file`,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const message = data?.error?.message ?? data?.message ?? JSON.stringify(data ?? {});
      throw new InternalServerErrorException(
        `Falha ao baixar PDF: ${status ?? 'unknown'} ${message}`
      );
    }

    const rawBuffer = Buffer.from(fileBytes);

    if (format === 'PDF') {
      const relaxed = opts?.relaxedPdfCheck === true;
      if (!this.isPdfBuffer(rawBuffer, relaxed)) {
        throw new InternalServerErrorException(this.describeInvalidPdf(rawBuffer));
      }

      if (!opts?.title || opts?.skipStamp) return { buffer: rawBuffer, kind: 'pdf' };

      try {
        const stamped = await this.stampPdfTitle(fileBytes, opts.title);
        const stampedBuffer = Buffer.from(stamped);
        const finalBuffer = this.isPdfBuffer(stampedBuffer, relaxed) ? stampedBuffer : rawBuffer;
        return { buffer: finalBuffer, kind: 'pdf' };
      } catch (err: any) {
        console.warn('Falha ao carimbar PDF, retornando original.', err?.message ?? err);
        return { buffer: rawBuffer, kind: 'pdf' };
      }
    }

    if (format === 'PNG') {
      if (this.isPngBuffer(rawBuffer)) return { buffer: rawBuffer, kind: 'png' };
      if (this.isZipBuffer(rawBuffer)) return { buffer: rawBuffer, kind: 'zip' };
      throw new InternalServerErrorException(this.describeInvalidPdf(rawBuffer));
    }

    return { buffer: rawBuffer, kind: 'pdf' };
  }
}
