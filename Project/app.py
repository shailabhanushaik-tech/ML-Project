from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "ckd_pipeline.joblib"
FEATURE_COLUMNS = [
    "age", "bp", "sg", "al", "su", "rbc", "pc", "pcc", "ba", "htn", "dm", "appet"
]
_model = None
_model_error = None


def get_model():
    global _model, _model_error
    if _model is not None:
        return _model, None
    if _model_error is not None:
        return None, _model_error
    if not MODEL_PATH.is_file():
        _model_error = "No validated trained pipeline installed; showing educational indicator only."
        return None, _model_error

    try:
        import joblib

        _model = joblib.load(MODEL_PATH)
        if not hasattr(_model, "predict"):
            raise ValueError("The model artifact does not expose predict().")
        return _model, None
    except Exception as error:
        _model_error = f"The trained pipeline could not be loaded: {error}"
        return None, _model_error


def send_json(handler, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlparse(self.path).path == "/api/model-status":
            model, error = get_model()
            send_json(self, {"available": model is not None, "message": error or "Trained pipeline connected."})
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/predict":
            self.send_error(404)
            return

        model, error = get_model()
        if model is None:
            send_json(self, {"message": error}, status=503)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 16_384:
                raise ValueError("Request is too large.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or set(data) != set(FEATURE_COLUMNS):
                raise ValueError("Provide all screening fields with no extra values.")

            import pandas as pd

            prediction = model.predict(pd.DataFrame([data], columns=FEATURE_COLUMNS))[0]
            predicted_class = str(prediction).strip().lower()
            if predicted_class in {"1", "ckd", "positive", "yes"}:
                result = {"level": "high", "label": "CKD pattern detected", "message": "The model flagged this profile. Review the result with a qualified clinician."}
            elif predicted_class in {"0", "notckd", "not ckd", "negative", "no"}:
                result = {"level": "low", "label": "CKD pattern not detected", "message": "The model did not flag this profile. This does not rule out kidney disease."}
            else:
                raise ValueError("The model must return 1/0 or ckd/notckd class labels.")
            send_json(self, result)
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            send_json(self, {"message": str(error)}, status=400)
        except Exception as error:
            send_json(self, {"message": f"Prediction failed: {error}"}, status=500)


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8000
    server = ThreadingHTTPServer((host, port), QuietHandler)
    print(f"Serving Kidney Disease dashboard at http://localhost:{port}")
    server.serve_forever()
