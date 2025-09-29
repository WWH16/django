from gradio_client import Client

SPACE = "CEENNNNNN/UFP_MODEL"
TOKEN = "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"

try:    
    # Use token always to avoid "Invalid credentials"
    client = Client(SPACE, hf_token=TOKEN)

    result = client.predict(
        texts="Hello!!",
        api_name="/predict"
    )
    print("Prediction:", result)

except Exception as e:
    print("Error while calling HF Space:", e)
