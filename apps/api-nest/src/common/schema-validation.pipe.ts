import { Injectable, StandardSchemaValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { ApiException } from './api-exception.js';
import { issuesToDetails } from './validation.js';

/**
 * Global pipe for the `{ schema }` option of `@Body`, `@Query` and `@Param` (Nest 12 Standard Schema
 * support). Invalid bodies and queries become `422 VALIDATION_FAILED`; an invalid path parameter
 * (for example a non-UUID id) means the resource cannot exist, so it becomes `404 NOT_FOUND`.
 */
@Injectable()
export class SchemaValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({ transform: true });
  }

  override async transform<T = unknown>(value: T, metadata: ArgumentMetadata): Promise<T> {
    const schema = metadata.schema;
    if (!schema || !this.toValidate(metadata)) return value;
    this.stripProtoKeys(value);
    const result = await this.validate<T>(value, schema, this.validateOptions);
    if (!result.issues) return result.value;
    if (metadata.type === 'param') throw ApiException.notFound();
    throw ApiException.validation(issuesToDetails(result.issues));
  }
}
