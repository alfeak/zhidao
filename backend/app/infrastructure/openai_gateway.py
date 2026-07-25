import httpx
from ..domain.errors import ValidationError

class OpenAICompatibleGateway:
    async def generate(self, config, prompt, system_instruction=None, response_json=False):
        models = config["models"]
        model = next((item for item in models if item["isPrimary"]), models[0] if models else None)
        if not model: raise ValidationError("No primary OpenAI-compatible model is configured.")
        if not model["apiKey"]: raise ValidationError(f"API key is missing for model: {model['name']}")
        base_url = (model["baseUrl"] or "https://api.openai.com/v1").rstrip("/")
        messages = ([{"role": "system", "content": system_instruction}] if system_instruction else []) + [{"role": "user", "content": prompt}]
        payload = {"model": model["name"], "messages": messages}
        if response_json: payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(f"{base_url}/chat/completions", headers={"Authorization": f"Bearer {model['apiKey']}", "Content-Type": "application/json"}, json=payload)
            response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]