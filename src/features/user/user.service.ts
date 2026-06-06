import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByEmailAndTenant(email: string, tenantId: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findOne({ email, tenant_id: tenantId }).exec();
  }

  async findByIdAndTenant(id: string | Types.ObjectId, tenantId: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: id, tenant_id: tenantId }).exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: userData.email, tenant_id: userData.tenant_id }).exec();
    if (existing) {
      throw new ConflictException('User with this email already exists in this tenant');
    }
    const createdUser = new this.userModel(userData);
    return createdUser.save();
  }
}
