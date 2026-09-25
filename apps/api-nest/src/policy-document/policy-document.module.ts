import { Module } from '@nestjs/common';
import { PolicyDocumentController } from './policy-document.controller.js';

@Module({ controllers: [PolicyDocumentController] })
export class PolicyDocumentModule {}
