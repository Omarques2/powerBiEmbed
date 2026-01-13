import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { PowerBiService } from "./powerbi.service";
import { AuthGuard } from "../auth/auth.guard";
import { UsersService } from "../users/users.service";
import { BiAuthzService } from "../bi-authz/bi-authz.service";
import type { AuthedRequest } from "../auth/authed-request.type";
import { ActiveUserGuard } from "../auth/active-user.guard";
import { EmbedConfigQueryDto, ExportReportDto, WorkspaceQueryDto } from "./dto/powerbi.dto";

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

  @UseGuards(AuthGuard, ActiveUserGuard)
  @Get("reports")
  async getReports(@Req() req: AuthedRequest, @Query() query: WorkspaceQueryDto) {
    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    return this.biAuthz.listAllowedReports(user.id, query.workspaceId);
  }

  @UseGuards(AuthGuard, ActiveUserGuard)
  @Get("embed-config")
  async getEmbedConfig(
    @Req() req: AuthedRequest,
    @Query() query: EmbedConfigQueryDto,
  ) {
    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    await this.biAuthz.assertCanViewReport(user.id, query.workspaceId, query.reportId);
    const customerId = await this.biAuthz.getWorkspaceCustomerId(user.id, query.workspaceId);
    const username = user.email ?? user.id;
    return this.svc.getEmbedConfig(query.workspaceId, query.reportId, {
      username,
      roles: ["CustomerRLS"],
      customData: customerId,
    });
  }

  @UseGuards(AuthGuard, ActiveUserGuard)
  @Post("export/pdf")
  @HttpCode(200)
  async exportReportPdf(
    @Req() req: AuthedRequest,
    @Body()
    body: ExportReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const workspaceId = body?.workspaceId;
    const reportId = body?.reportId;
    const format = (body?.format ?? "PDF").toUpperCase();

    if (!workspaceId || !reportId) {
      throw new BadRequestException("workspaceId and reportId are required");
    }

    if (format !== "PDF" && format !== "PNG") {
      throw new BadRequestException("format must be PDF or PNG");
    }

    const user = await this.usersService.upsertFromClaims(req.user ?? {});
    await this.biAuthz.assertCanViewReport(user.id, workspaceId, reportId);
    const customerId = await this.biAuthz.getWorkspaceCustomerId(user.id, workspaceId);
    const username = user.email ?? user.id;

    const result = await this.svc.exportReportFile(workspaceId, reportId, {
      username,
      roles: ["CustomerRLS"],
      customData: customerId,
      bookmarkState: body?.bookmarkState,
      format: format as "PDF" | "PNG",
      pageName: body?.pageName,
      skipStamp: body?.skipStamp,
      relaxedPdfCheck: body?.relaxedPdfCheck,
      forceIdentity: body?.forceIdentity,
    });

    const extension = result.kind === "zip" ? "zip" : result.kind;
    const contentType =
      result.kind === "zip"
        ? "application/zip"
        : result.kind === "png"
          ? "image/png"
          : "application/pdf";
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="report.${extension}"`,
      "Cache-Control": "no-store",
    });

    return new StreamableFile(result.buffer);
  }
}
