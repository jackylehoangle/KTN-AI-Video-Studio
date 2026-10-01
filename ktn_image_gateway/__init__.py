"""KTN internal image gateway.

This package is intentionally isolated from MoneyPrinterTurbo's core app
package. It exposes an OpenAI-compatible image API facade that will delegate
generation to ComfyUI/Flux in later MPT-04B phases.
"""

__all__ = ["__version__"]
__version__ = "0.1.0"
