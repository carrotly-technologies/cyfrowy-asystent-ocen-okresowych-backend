import { Module } from '@nestjs/common';
import { OspController } from './osp.controller.js';

@Module({ controllers: [OspController] })
export class OspModule {}
