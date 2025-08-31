교무타임 – 파일 브로커 (Monorepo)

개요

- 프런트: Vite + React + TypeScript + Tailwind + Framer Motion (Apple 톤의 UI/모션)
- 서버리스: Netlify Functions (TypeScript) + Firebase Admin SDK
- 데이터: Firebase Auth (Google), Firestore, Storage(서명 URL 전용 접근)
- 권한: user/admin/custom claims, 슈퍼관리자 이메일: yangchanhee11@gmail.com
- 테스트: Vitest(유닛) + Playwright(E2E)

디렉터리 구조

- `/web`: React 앱 (랜딩 `/`, 대시보드 `/app`)
- `/netlify/functions`: 서버리스 함수 (auth/storage/submission/notify)
- `firestore.rules`, `storage.rules`: 보안 규칙
- `netlify.toml`: 빌드/퍼블리시/Functions 설정
- `playwright.config.ts`: E2E 설정

로컬 실행

1) Firebase 프로젝트 생성 후 Firestore/Storage 활성화
2) `.env` 생성: 루트와 `/web` 동일 환경 사용. 루트 `.env` 필요 없음. Netlify UI에 서버리스 키 등록.
   - `VITE_FIREBASE_CONFIG` (예시는 문서 하단 참고)
   - Netlify 환경변수: `FIREBASE_SERVICE_ACCOUNT_JSON` (서비스계정 JSON 전체)
3) 의존성 설치: `npm i`
4) 개발 서버: `npm run dev` (Vite + Netlify Functions 동시 실행)
5) 브라우저: `http://localhost:8888` (권장, Functions 포함) — 루트 `index.html`은 런처로 자동 리다이렉트 버튼 제공

배포 (Netlify)

- Netlify에 새 사이트 생성 → 이 저장소 연결
- 환경변수 등록: `VITE_FIREBASE_CONFIG`, `FIREBASE_SERVICE_ACCOUNT_JSON`, (선택)`RESEND_API_KEY`
- 빌드 명령: 루트 `npm run build` (publish: `web/dist`, functions: `netlify/functions`)

보안/권한 모델

- 최초 로그인: user 역할
- 관리자(admin): custom claims로 부여(서버리스 `auth/setAdmin`) — 슈퍼관리자만 가능
- Firestore/Storage 규칙: `firestore.rules`, `storage.rules` 적용
- 파일 업/다운로드: 항상 서버리스 함수가 발급한 서명 URL로만 수행

필요 HTTP 엔드포인트 (Netlify Functions)

- `auth/setAdmin`: 슈퍼관리자만 — 대상 이메일 admin 권한 부여/해제
- `storage/createUploadUrl`: 제출 파일 업로드용 서명 URL 발급
- `storage/createDownloadUrl`: 결과/원본 다운로드용 서명 URL 발급
- `submission/create`: 제출 생성(status=uploaded)
- `submission/updateStatus`: 관리자 전용 상태 변경
- `submission/appendResult`: 결과 파일 메타 추가 + 업로드 URL 반환
- `submission/message`: 메시지 추가(사용자/관리자)
- (선택) `notify/email`: 알림 이메일 전송(Resend)

테스트

- 유닛(vitest): 폼 스키마/유틸
- E2E(playwright): 기본 랜딩/네비게이션 (Firebase 연결 시 확장 가능)

Firebase 클라이언트 설정(JSON)

VITE_FIREBASE_CONFIG 예시(JSON):
{
  "apiKey": "AIzaSyCtKBMC_l_YTtTIGuvWil4hAMO2SxLutnA",
  "authDomain": "gyomutime-ea929.firebaseapp.com",
  "projectId": "gyomutime-ea929",
  "storageBucket": "gyomutime-ea929.firebasestorage.app",
  "messagingSenderId": "1018950329432",
  "appId": "1:1018950329432:web:c42c417a9138e0f4a0962d",
  "measurementId": "G-N31BTHB5C2"
}

Colab 연동 (코드 비공개)

- 목표: 웹에 코드/키가 내려오지 않도록 Colab 런타임만 노출합니다.

구성

- 퍼블릭 설정: `assets/js/colab-config.js`
  - `COLAB_IFRAME_URL`: Gradio 공유 URL을 넣으면 랜딩 페이지 하단에 자동 임베드됩니다.
  - `COLAB_API_BASE`: Flask/ngrok 등 REST 엔드포인트 베이스 URL. JS에서 `window.colab.postJSON()`으로 호출.
  - 둘 다 비워두면 아무 것도 표시/호출하지 않습니다.

임베드(Gradio) 방식

1) Colab 노트북에서 Gradio 실행
   ```python
   !pip -q install gradio
   import gradio as gr

   def optimize(json_text):
       """사용자 코드로 교체 예정"""
       return json_text

   demo = gr.Interface(optimize, gr.Textbox(lines=6, label="입력 JSON"), gr.Textbox(label="결과"))
   demo.launch(share=True)
   ```
2) 출력되는 `https://xxxx.gradio.live`를 `assets/js/colab-config.js`의 `COLAB_IFRAME_URL`에 넣습니다.

REST API 방식

1) Colab 노트북에서 간단한 API 실행 (예시 계약)
   ```python
   !pip -q install flask flask-cors pyngrok
   from flask import Flask, request, jsonify
   from flask_cors import CORS
   from pyngrok import ngrok

   app = Flask(__name__)
   CORS(app)  # 필요한 도메인만 허용하도록 좁히는 것을 권장

   @app.post('/optimize')
   def optimize():
       payload = request.get_json(force=True) or {}
       # TODO: 사용자 제공 코드로 교체
       return jsonify({ 'ok': True, 'result': payload })

   public_url = ngrok.connect(5000).public_url
   print('PUBLIC_URL=', public_url)
   app.run(host='0.0.0.0', port=5000)
   ```
2) 콘솔에 표시되는 `PUBLIC_URL`을 `assets/js/colab-config.js`의 `COLAB_API_BASE`에 넣습니다.
3) 프런트엔드에서 호출 예시:
   ```js
   // 아무 곳에서나
   window.colab.postJSON('/optimize', { foo: 'bar' })
     .then(console.log)
     .catch(console.error)
   ```

보안 메모

- HTML/JS에는 API 키/토큰을 절대 넣지 않습니다. 키는 Colab 런타임(서버 측)에만 보관하세요.
- Colab/Gradio/ngrok URL은 일시적입니다(세션 만료/URL 변경). 데모/프로토타입 용도에 적합합니다.
- CORS는 필요한 오리진만 허용하는 것을 권장합니다.

실시간 실행 + n8n 연동

- 목표: 사용자가 버튼을 누르면 Colab에서 코드를 GPT로 변형·실행하고, 진행상황을 실시간(SSE)으로 웹에 표시, 완료 시 결과 다운로드 링크 제공.

구성 요소

- 프런트: `index.html` 섹션(버튼/상태/다운로드), `assets/js/optimizer-ui.js`가 Colab API(`/jobs`, `/events/:id`)를 호출
- 백엔드(Colab): `docs/colab_server_app.py` — Flask + SSE + (선택) n8n 또는 OpenAI 호출
- 설정: `assets/js/colab-config.js`의 `COLAB_API_BASE`에 Colab 공개 URL 설정

Colab 서버 실행

1) Colab에서 사전 설치
   ```python
   !pip -q install flask flask-cors pyngrok requests
   ```
2) `docs/colab_server_app.py` 내용을 노트북 셀에 복사 후, 맨 아래 예시에 따라 ngrok로 공개 URL 확보 후 실행
   ```python
   from pyngrok import ngrok
   public_url = ngrok.connect(5000).public_url
   print('PUBLIC_URL=', public_url)
   %env ALLOWED_ORIGINS=https://<your-site>.netlify.app
   # 선택 1: n8n 사용
   # %env N8N_GPT_WEBHOOK=https://<n8n-host>/webhook/gpt-transform
   # 선택 2: OpenAI 직접 사용 (키는 노트북 비공개 환경변수에만 보관)
   # %env OPENAI_API_KEY=sk-...
   app.run(host='0.0.0.0', port=5000)
   ```
3) 프런트 설정: `assets/js/colab-config.js`의 `COLAB_API_BASE`에 `PUBLIC_URL` 값을 넣고 배포

동작 흐름

- 프런트가 `/jobs` POST로 `{ kind, requirements, input }` 전송
- Colab 서버는 n8n 또는 OpenAI를 통해 `optimize(spec,data)` 함수를 생성(또는 기존 코드 재사용) 후 실행
- `/events/:id` SSE로 로그/진행/완료 이벤트 전송 → 프런트에서 실시간 표시
- 완료 시 `/download/:id`로 결과(JSON 등) 다운로드 가능, 프런트에서 버튼 활성화

n8n 연동 방법(옵션)

- Colab → n8n 방향을 권장(키/프롬프트 관리 일원화). Colab 서버의 `N8N_GPT_WEBHOOK`로 POST:
  - 요청(JSON): `{ "requirements": string, "input": object }`
  - 응답(JSON): `{ "code": "def optimize(spec, data): ..." }`
- n8n 워크플로 예시
  1) Trigger: Webhook (POST)
  2) Node: OpenAI(Chat Completions) — system: "파이썬 함수 optimize(spec,data)만 코드로 출력", user: requirements + input 샘플
  3) Node: Function — 응답 텍스트에서 코드펜스 제거해 `{ code }`로 정리
  4) Respond to Webhook — JSON `{ code }`

보안 주의사항

- 프런트에는 절대 API 키/코드가 내려오지 않습니다. 키는 n8n/Colab 환경변수에만 저장하세요.
- Colab URL은 일시적입니다. 세션 만료 시 `COLAB_API_BASE`를 갱신해야 합니다.
- CORS의 허용 오리진을 배포 도메인으로 제한하세요.
