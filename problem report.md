# Photo AI Analysis Feature — Troubleshooting Report

**Date:** July 24, 2026
**Affected Module:** AI-powered photo analysis feature (`/analyze_photo` endpoint)
**Reported by:** [Please fill in name]

---

## 1. Issue Description

After the user takes a photo or uploads an image in the mobile app, the system is expected to call the Qwen (Tongyi Qianwen) vision-language model to analyze the image content, and return a short event title and a detailed description to be used for generating a diary entry.

**Observed behavior:** Regardless of the actual photo content, every upload returns the exact same static placeholder response:

```json
{
  "success": true,
  "title": "Photo Event",
  "description": "A photo uploaded by the user."
}
```

In other words, the AI analysis feature has never actually produced a genuine result — users never see any content-specific recognition output for their photos.

---

## 2. Investigation Process

To identify the root cause, the following systematic investigation was carried out:

### 2.1 Verifying the Code Call Chain

First, the interaction between the frontend (`rn-app/app/(tabs)/index.tsx`) and the backend (`backend/api/index.py`, `backend/api/llm.py`) was reviewed:

- After the user takes/selects a photo, the frontend uses `expo-image-picker` to obtain the image as a Base64-encoded string, and sends it together with the request to the backend endpoint `/analyze_photo`.
- On the backend, `index.py` receives the request and calls `generate_title_from_image()` in `llm.py`, which uses `QWEN_API_KEY` to call Alibaba Cloud's Tongyi Qianwen `qwen-vl-max` vision-language model via the OpenAI-compatible protocol.

Upon code review, **this call chain logic is correctly designed** — parameter passing and format conversion (Base64 → Data URL) both match expectations, and there are no structural issues in the code.

### 2.2 Verifying Backend Service Availability

Using `curl`, the deployed production backend (`https://dongkaifyp.brennanjones.com`) was tested directly:

- First, the health-check endpoint `/health` was tested and returned normally, confirming the backend service itself is online and reachable.
- Next, a real photo (a genuine image downloaded from the internet, not a blank/solid-color image) was sent to `/analyze_photo` to simulate an actual upload. The result was still the same fixed placeholder response, rather than an analysis result reflecting the actual image content.

This indicates that **the problem is not related to image size, network transmission, or the compression `quality` setting, but occurs specifically in the step where the backend calls the AI model.**

### 2.3 Root Cause Identified: API Key Authentication Failure

To further confirm the issue, the backend was bypassed entirely. The `QWEN_API_KEY` recorded in the project's configuration file (`backend/.env`) was used to independently call the Tongyi Qianwen official API directly from a local environment.

**Test result:**

```
ERROR: AuthenticationError("Error code: 401 -
{'error': {'message': 'Incorrect API key provided.
For details, see: https://help.aliyun.com/zh/model-studio/error-code#apikey-error',
'type': 'invalid_request_error', 'code': 'invalid_api_key'}}")
```

This error message clearly shows that **the `QWEN_API_KEY` currently configured is invalid or has expired**. The request is rejected by Alibaba Cloud's servers at the authentication stage, meaning subsequent photo analysis requests never actually reach the AI model for processing.

### 2.4 Why the Failure Was Silently Swallowed

Under normal circumstances, an authentication failure should cause the endpoint to return an explicit error status code (e.g., HTTP 500). However, in actual testing, the endpoint returned `"success": true` without exposing any error. After reviewing the code logic and inline comments, the likely explanation is:

**The code currently running in the production environment (Vercel) may be an older version than the local repository.** The local codebase's `llm.py` has already been updated to fix this issue (any AI API call failure now raises an exception, making the problem visible and loggable). However, the version deployed on Vercel may still be the older, pre-fix version, which silently returns a placeholder response on authentication failure instead of surfacing the real error — which is also why this issue went unnoticed for a while.

---

## 3. Conclusion

The root cause of this issue can be summarized in the following two points, **both of which are configuration/deployment issues rather than code logic errors**:

1. **The Tongyi Qianwen API key (`QWEN_API_KEY`) has expired or is invalid**, causing every photo analysis request to be rejected at the authentication stage.
2. **The production deployment (Vercel) may be running an outdated version of the code**, causing the authentication failure to be silently handled by the old logic instead of being surfaced as an error.

The call chain and data transmission format (Base64 encoding) between the frontend and backend have both been confirmed to be correct.

---

## 4. Recommended Fixes

1. Go to the Alibaba Cloud Bailian (DashScope) console and verify or regenerate a new, valid `QWEN_API_KEY`.
2. Log in to the Vercel project dashboard and check/update the production environment variables to ensure the new key is properly synced.
3. Redeploy the latest code from the local repository (`git push` / `vercel --prod`) to ensure the production environment is running the latest version of the error-handling logic, so that if a similar issue occurs in the future, it can be immediately detected via logs/error status codes instead of being silently masked.
4. After the fix, re-test the `/analyze_photo` endpoint using a real photo to confirm that the response contains a genuine analysis result corresponding to the actual image content, rather than the default placeholder.

---

*This report is based on static code review, actual endpoint request testing, and independent verification of the third-party API. The root-cause identification process described above is fully reproducible.

找到了问题所在，答案是：**不是代码链路的问题，是 QWEN_API_KEY 失效了（认证 401 错误）**。

## 排查过程与证据

**1. 测试真实图片，接口始终返回默认值**
用一张真实的、内容丰富的照片（400x300 猫图）请求 `/analyze_photo`，本应该让 Qwen 识别出具体场景，结果依然只返回了写死的默认值：
```json
{"success":true,"title":"Photo Event","description":"A photo uploaded by the user."}
```
这不正常——正常调用 Qwen 视觉大模型分析真实照片时，应该输出具体的场景描述，而不是每次都是一样的默认文案。

**2. 直接用本地 `.env` 里的 Key 测试 Qwen API 本身**
绕过后端，直接拿 `backend/.env` 里配置的 `QWEN_API_KEY` 去调用 Qwen 的官方接口，得到明确的错误：
```
ERROR: AuthenticationError("Error code: 401 - {'error': {'message': 'Incorrect API key provided.
...code': 'invalid_api_key'}...")
```
**这证明：`QWEN_API_KEY` 本身是无效/错误的 Key，认证都过不了。**

**3. 为什么线上接口没有直接报错？**
根据 `llm.py` 里的代码注释：
> "Raises on failure instead of silently returning a static placeholder" — 说明**代码曾经有一个旧版本，遇到失败会静默返回默认占位符**，现在的代码已经改成了遇到错误会 `raise RuntimeError` 并让 `index.py` 转成 500 错误。

但线上（Vercel）返回的行为和"旧版本的静默失败逻辑"完全一致——说明**Vercel 上部署的代码版本，很可能落后于你本地仓库里的最新代码**，还在跑没有严格报错的旧逻辑，把认证失败悄悄吞掉，返回了默认值，而不是让你看到明确的 500 错误。

## 结论 & 建议

你的**代码链路（前端 base64 采集 → POST /analyze_photo → llm.py 调用 Qwen）本身没有问题**，问题在于：

1. **`QWEN_API_KEY` 无效**（Key 可能过期、被撤销，或复制错了），需要去阿里云 DashScope 控制台重新生成/核对一个有效的 Key。
2. **Vercel 上的环境变量和部署代码需要同步更新**：
   - 去 Vercel Dashboard 检查 `QWEN_API_KEY` 环境变量是否配置正确（跟本地 `.env` 是完全独立的两套配置）。
   - 确认最新的 `llm.py`/`index.py` 代码已经重新部署到 Vercel（如果本地改过代码但没有 `git push` / `vercel deploy`，线上跑的可能还是旧版本）。

建议先去阿里云控制台确认 Key 是否有效，换一个正确的 Key 后在 Vercel 更新环境变量并重新部署，应该就能解决"每次分析图片都没有结果"的问题。

