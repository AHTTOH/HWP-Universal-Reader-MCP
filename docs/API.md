# API Reference

## Tools

### read_hwp

Extracts all text and metadata from HWP 5.0+ files.

**Input**

```json
{
  "filePath": "/absolute/path/to/document.hwp",
  "fileUrl": "https://example.com/document.hwp",
  "fileContentBase64": "BASE64_DATA",
  "fileName": "document.hwp"
}
```

**Output**

```json
{
  "text": "extracted text",
  "metadata": {
    "version": "5.0.0.0",
    "author": "Author Name",
    "title": "Document Title",
    "pages": 12
  }
}
```

### read_hwpx

Extracts text and metadata from HWPX files.

**Input**

```json
{
  "filePath": "/absolute/path/to/document.hwpx",
  "fileUrl": "https://example.com/document.hwpx",
  "fileContentBase64": "BASE64_DATA",
  "fileName": "document.hwpx"
}
```

**Output**

```json
{
  "text": "extracted text",
  "metadata": {
    "version": "1.1",
    "author": "Author Name",
    "title": "Document Title",
    "pages": 5
  }
}
```

### convert_to_docx

Converts HWP or HWPX to DOCX.

**Input**

```json
{
  "filePath": "/absolute/path/to/document.hwp",
  "fileUrl": "https://example.com/document.hwp",
  "fileContentBase64": "BASE64_DATA",
  "fileName": "document.hwp",
  "outputPath": "/absolute/path/to/output.docx",
  "returnBase64": true
}
```

**Output**

```json
{
  "success": true,
  "docxPath": "/absolute/path/to/output.docx",
  "originalSize": 1048576,
  "convertedSize": 2048000,
  "docxBase64": "BASE64_DOCX",
  "docxFileName": "document.docx"
}
```

## Error Codes

- `FILE_NOT_FOUND`
- `UNSUPPORTED_VERSION`
- `ENCRYPTED`
- `CORRUPTED`
- `FILE_TOO_LARGE`
- `PERMISSION_DENIED`
- `PARSE_ERROR`
- `CONVERSION_ERROR`
- `OUT_OF_MEMORY`
