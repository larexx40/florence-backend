// Admin endpoints all return a User record as their data payload.
// Use UserDto (from src/common/dto/user.dto) with getSchemaPath(UserDto) in the controller.
// No bespoke admin-specific response shape is needed beyond what UserDto already describes.

export { UserDto as AdminUserResponseDto } from 'src/common/dto/user.dto';
