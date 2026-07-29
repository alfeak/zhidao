import json as _json
import httpx
from ..domain.errors import ValidationError


def _resolve_model(config: dict):
    models = config.get("models") or []
    model = next((m for m in models if m.get("isPrimary")), models[0] if models else None)
    if not model:
        raise ValidationError("未配置有效的大模型（No primary OpenAI-compatible model is configured）。")
    if not model.get("apiKey"):
        raise ValidationError(f'模型 [{model.get("name", "未命名")}] 缺少 API Key，请在【设置 -> 大模型设置】中配置并设为主配置。')
    return model


class OpenAICompatibleGateway:
    async def generate(self, config, prompt, system_instruction=None, response_json=False):
        model = _resolve_model(config)
        base_url = (model.get("baseUrl") or "https://api.openai.com/v1").rstrip("/")
        messages = ([{"role": "system", "content": system_instruction}] if system_instruction else []) + [{"role": "user", "content": prompt}]
        payload = {"model": model.get("name"), "messages": messages}
        if response_json:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=90, trust_env=False) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {model['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                )
                if response.status_code != 200:
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message") or err_json.get("message") or response.text
                    except Exception:
                        err_msg = response.text
                    raise ValidationError(f"大模型 API 响应异常 ({response.status_code}): {err_msg}")
                data = response.json()
                choices = data.get("choices") or []
                if not choices:
                    raise ValidationError("大模型 API 返回消息体中未包含有效 Choices 内容。")
                return choices[0]["message"]["content"]
        except httpx.RequestError as e:
            raise ValidationError(f"无法连接至大模型服务 ({base_url}): {str(e)}")

    async def generate_stream(self, config, prompt, system_instruction=None):
        """Async generator that yields text chunks from the LLM streaming API."""
        model = _resolve_model(config)
        base_url = (model.get("baseUrl") or "https://api.openai.com/v1").rstrip("/")
        messages = ([{"role": "system", "content": system_instruction}] if system_instruction else []) + [{"role": "user", "content": prompt}]
        payload = {"model": model.get("name"), "messages": messages, "stream": True}

        try:
            async with httpx.AsyncClient(timeout=180, trust_env=False) as client:
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {model['apiKey']}", "Content-Type": "application/json"},
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        try:
                            err_json = _json.loads(body)
                            err_msg = err_json.get("error", {}).get("message") or err_json.get("message") or body.decode()
                        except Exception:
                            err_msg = body.decode(errors="replace")
                        raise ValidationError(f"大模型 API 响应异常 ({response.status_code}): {err_msg}")

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            obj = _json.loads(data)
                            delta = (obj.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
                            if delta:
                                yield delta
                        except Exception:
                            continue
        except httpx.RequestError as e:
            raise ValidationError(f"无法连接至大模型服务 ({base_url}): {str(e)}")