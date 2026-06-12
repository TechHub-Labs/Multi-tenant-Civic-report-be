import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Tenant } from '../../tenant/schemas/tenant.schema';

export type ReportDocument = Report & Document;

export enum ReportStatus {
  SUBMITTED = 'submitted',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Schema({ _id: false })
export class TimelineEntry {
  @Prop({ type: String, enum: ReportStatus, required: true })
  status: ReportStatus;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updated_by: Types.ObjectId;

  @Prop({ default: Date.now })
  updated_at: Date;
}

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: Tenant.name, required: true, index: true })
  tenant_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporter_id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ type: String, enum: ReportStatus, required: true, default: ReportStatus.SUBMITTED, index: true })
  status: ReportStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assigned_to?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  media_urls: string[];

  @Prop({ type: [TimelineEntry], default: [] })
  timeline: TimelineEntry[];
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Index location for geospatial queries
ReportSchema.index({ location: '2dsphere' });
