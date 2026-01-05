import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";

import { PowerBiService } from "./powerbi.service";
import { AuthGuard } from "../auth/auth.guard";
import { UsersService } from "../users/users.service";
import { BiAuthzService } from "../bi-authz/bi-authz.service";
import type { AuthedRequest } from "../auth/authed-request.type";
import { ActiveUserGuard } from "src/auth/active-user.guard";

@Controller("powerbi")
export class PowerBiController {
  constructor(
    private readonly svc: PowerBiService,
    private readonly usersService: UsersService,
    private readonly biAuthz: BiAuthzService,
  ) {}

  @UseGuards(AuthGuard, ActiveUserGuard)
  @Get("workspaces")
  async getWorkspaces(@Req() req: AuthedRequest) {
    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    return this.biAuthz.listAllowedWorkspaces(user.id);
  }

  @UseGuards(AuthGuard)
  @Get("reports")
  async getReports(@Req() req: AuthedRequest, @Query("workspaceId") workspaceId: string) {
    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    return this.biAuthz.listAllowedReports(user.id, workspaceId);
  }

  @UseGuards(AuthGuard)
  @Get("embed-config")
  async getEmbedConfig(
    @Req() req: AuthedRequest,
    @Query("workspaceId") workspaceId: string,
    @Query("reportId") reportId: string,
  ) {
    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    await this.biAuthz.assertCanViewReport(user.id, workspaceId, reportId);
    return this.svc.getEmbedConfig(workspaceId, reportId);
  }
}
