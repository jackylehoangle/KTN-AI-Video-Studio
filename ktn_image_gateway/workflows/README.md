# ComfyUI workflow contract

MPT-04B.3 expects an **API-format** ComfyUI workflow at:

`ktn_image_gateway/workflows/flux_text2img.json`

Export the workflow from the ComfyUI UI using its API/workflow export function,
then replace the relevant literal input values with these exact tokens:

- `__KTN_PROMPT__` — positive text prompt
- `__KTN_WIDTH__` — output width
- `__KTN_HEIGHT__` — output height
- `__KTN_SEED__` — sampler/noise seed

Only `__KTN_PROMPT__` is mandatory in the loader. Width, height, and seed can
remain fixed in the ComfyUI workflow during early testing if required.

The generated image must reach a normal ComfyUI image-output node so that the
execution history exposes an `images` entry containing `filename`,
`subfolder`, and `type`.

The actual `flux_text2img.json` is intentionally not invented by the gateway.
It must match the Flux nodes and model filenames installed on the machine that
will run ComfyUI.
