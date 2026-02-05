import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateItemDto {
  @IsOptional()
  @IsString()
  supplyId?: string;

  @IsOptional()
  @IsString()
  supplyName?: string;

  @IsNumber()
  @Type(() => Number)
  requiredQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateUserKitFromTemplateDto {
  @IsString()
  templateId: string;

  @IsString()
  templateName: string;

  @IsString()
  locationId: string;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsBoolean()
  includeItems: boolean;

  @IsOptional()
  @IsBoolean()
  isPublicTemplate?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  selectedPeopleCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  templateItems?: TemplateItemDto[];
}
