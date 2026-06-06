import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Tenant } from '../../tenant/schemas/tenant.schema';

export type UserDocument = User & Document;

export enum Role {
  CITIZEN = 'citizen',
  TECHNICIAN = 'technician',
  ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ type: Types.ObjectId, ref: Tenant.name, required: true, index: true })
  tenant_id: Types.ObjectId;

  @Prop({ type: String, enum: Role, required: true, default: Role.CITIZEN })
  role: Role;

  @Prop({ required: true })
  first_name: string;

  @Prop({ required: true })
  last_name: string;

  @Prop()
  middle_name?: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop({ index: true })
  device_id?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Compound unique index so the same email can be used across different tenants
UserSchema.index({ tenant_id: 1, email: 1 }, { unique: true });
