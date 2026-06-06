import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

export enum JoinMode {
  OPEN = 'OPEN',
  DOMAIN_RESTRICTED = 'DOMAIN_RESTRICTED',
  INVITE_ONLY = 'INVITE_ONLY',
}

@Schema({ _id: false })
class ThemeConfig {
  @Prop({ required: true })
  primaryColor: string;

  @Prop({ required: true })
  logoUrl: string;
}

@Schema({ _id: false })
class JoinSettings {
  @Prop({ type: String, enum: JoinMode, required: true, default: JoinMode.OPEN })
  mode: JoinMode;

  @Prop({ type: [String], default: [] })
  allowed_domains: string[];

  @Prop({ type: [{ token: String, expiresAt: Date, role_assignment: String }], default: [] })
  active_invite_tokens: Array<{ token: string; expiresAt: Date; role_assignment: string }>;
}

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: ThemeConfig, required: true })
  theme_config: ThemeConfig;

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ type: Object }) // Storing as basic object for now, GeoJSON Polygon
  geofence_polygon?: Record<string, any>;

  @Prop({ type: JoinSettings, required: true, default: () => ({ mode: JoinMode.OPEN }) })
  join_settings: JoinSettings;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
