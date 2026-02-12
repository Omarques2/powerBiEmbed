import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const ADMIN_METRIC_WINDOWS = ['1h', '6h', '24h', '7d', '30d'] as const;
export type AdminMetricWindow = (typeof ADMIN_METRIC_WINDOWS)[number];

export const ADMIN_METRIC_BUCKETS = ['hour', 'day'] as const;
export type AdminMetricBucket = (typeof ADMIN_METRIC_BUCKETS)[number];

export class AdminAccessMetricsQueryDto {
  @IsOptional()
  @IsIn(ADMIN_METRIC_WINDOWS)
  window?: AdminMetricWindow;

  @IsOptional()
  @IsIn(ADMIN_METRIC_BUCKETS)
  bucket?: AdminMetricBucket;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topLimit?: number;
}
