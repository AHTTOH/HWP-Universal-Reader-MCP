# Troubleshooting

## FILE_NOT_FOUND

- Confirm the absolute file path.
- Verify the file exists on disk.
- Check the file name casing on case-sensitive systems.

## PERMISSION_DENIED

- Ensure the path is inside allowed roots.
- Update `HWP_MCP_ALLOWED_DIRS` to include the required directory.
- Verify file permissions for the current user.

## FILE_TOO_LARGE

- Files larger than 100MB are blocked.
- Reduce the file size or split the document.

## UNSUPPORTED_VERSION

- HWP 3.0 and older are not supported.
- Save the file as HWP 5.0+ using a compatible editor.

## ENCRYPTED

- Encrypted files are blocked for security.
- Decrypt the file locally and retry.

## CORRUPTED

- The file header or signature is invalid.
- Re-export the document and retry.

## PARSE_ERROR

- The file structure cannot be parsed.
- Try a different file or re-save the document.

## CONVERSION_ERROR

- Ensure the output path is writable.
- Check available disk space.
- Retry conversion after reopening the input file.

## OUT_OF_MEMORY

- Increase `HWP_MCP_MEMORY_LIMIT_MB`.
- Close other memory-heavy applications.
