# AI Extensions

The existing `aiAgent` behavior is the base implementation. An extension only
runs when an enabled assignment selects a compatible version; errors fall back
to the base implementation.

After migrations, register the built-in example:

```bash
python manage.py migrate ai_extensions
python manage.py register_builtin_extensions
```

The API is mounted at `/api/ai-extensions/`:

- `GET /extensions/?search=...` — catalog search
- `GET /versions/` — version metadata
- `GET /assignments/` — active scope assignments
- `GET /executions/` — execution/fallback audit log
- `POST /extensions/{id}/enable/` and `/disable/` — staff catalog switch

Python implementations must be deployed and referenced by an approved entry
point. Dashboard metadata must not be treated as arbitrary executable code.


Activation policy:

- Built-in extensions are registered disabled by default.
- An assignment enables an extension for its selected scope.
- By default, only one version of an extension can be active per scope. Enabling a new version automatically disables the previous assignment.
- Set `allow_multiple_active_versions: true` in the extension model/manifest only when multiple versions are intentionally compatible.


Built-in extension point keys now covered by the base flow include:
`answer-system-prompt`, `memory-extraction-prompt`, `memory-extraction-system`, `payment-verification-prompt`, `summary-prompt`, `audio-transcription-prompt`, `order-instruction`, `intent-classification`, `image-product-analysis`, and `image-search-rerank`. Each key keeps the original base text when no compatible assignment is active or when an extension fails.


Text override mode:

- `override_mode: "append"` is the default. The original base prompt is preserved and the extension update is appended.
- `override_mode: "replace"` intentionally removes the base prompt and uses only the extension result.
- If an extension already returns the full base-plus-update text, the dispatcher avoids duplicating the base text.


Multi-hook bundle extensions:

One extension version can expose multiple targets through `targets`, for example `[
"prompt", "validator", "function"
]`, while using one approved `entry_point`. The class can implement `apply`, `validate`, and `execute`; the dispatcher calls only the method required by the active hook. This is useful when one feature must update several related functions together.


Provider extensions use target `provider` and an extension key such as `image-analysis-provider`, `classification-provider`, or `transcription-provider`. Their `execute(payload, agent, user, context)` method owns the OpenAI/GPT implementation. The base Gemini function remains the fallback.
