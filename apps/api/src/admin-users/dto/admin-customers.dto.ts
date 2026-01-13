import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const CUSTOMER_STATUSES = ["active", "inactive"] as const;

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class UpdateCustomerStatusDto {
  @IsIn(CUSTOMER_STATUSES)
  status!: (typeof CUSTOMER_STATUSES)[number];
}
