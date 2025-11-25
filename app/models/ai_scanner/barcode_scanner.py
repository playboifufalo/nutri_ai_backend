# backend.py
from fastapi import FastAPI, UploadFile
from pyzbar.pyzbar import decode
from PIL import Image
import requests
import io

app = FastAPI()

@app.post("/analyze")
async def analyze_image(file: UploadFile):
    img = Image.open(io.BytesIO(await file.read()))
    barcodes = decode(img)
    if barcodes:
        code = barcodes[0].data.decode("utf-8")
        r = requests.get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json") #TODO: try to use other types of barcodes
        return {"barcode": code, "product": r.json().get("product", {})}
    return {"message": "No barcode found, try AI recognition."}
