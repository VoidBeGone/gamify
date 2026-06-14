import { Schema, model, Document, Types } from 'mongoose';

export interface IMetricsLog extends Document {
  user_id: Types.ObjectId;
  pillar_id?: Types.ObjectId;
  metric_type: string;
  value: number;
  secondary_value?: number;
  notes?: string;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

const MetricsLogSchema = new Schema<IMetricsLog>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pillar_id: { type: Schema.Types.ObjectId, ref: 'Pillar', index: true },
    metric_type: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    secondary_value: { type: Number },
    notes: { type: String },
    logged_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const MetricsLog = model<IMetricsLog>('MetricsLog', MetricsLogSchema);
