# Colab Flask server with SSE for real-time progress
# - Accepts optimization jobs
# - Optionally transforms code via n8n (preferred) or OpenAI
# - Streams progress via Server-Sent Events
# - Serves result files for download

import os, json, time, threading, queue, uuid, tempfile
from typing import Dict, Any
from flask import Flask, request, Response, jsonify, send_file
from flask_cors import CORS
import requests

app = Flask(__name__)

# Configure allowed origins for security
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*')  # e.g. "https://your-site.netlify.app"
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

JOBS: Dict[str, Dict[str, Any]] = {}
LOCK = threading.Lock()

def new_job() -> Dict[str, Any]:
    jid = str(uuid.uuid4())[:8]
    j = {
        'id': jid,
        'status': 'queued',
        'q': queue.Queue(),
        'result_path': None,
        'created_at': time.time(),
    }
    with LOCK:
        JOBS[jid] = j
    return j

def emit(j, typ: str, **data):
    payload = {'type': typ, **data}
    try:
        j['q'].put_nowait(payload)
    except Exception:
        pass

def transform_code_with_n8n(requirements: str, input_data: Dict[str, Any]) -> str:
    url = os.environ.get('N8N_GPT_WEBHOOK')
    if not url:
        return ''
    resp = requests.post(url, json={
        'requirements': requirements,
        'input': input_data,
    }, timeout=120)
    resp.raise_for_status()
    data = resp.json() if 'application/json' in resp.headers.get('content-type','') else {'code': resp.text}
    return data.get('code', '')

def transform_code_with_openai(requirements: str, input_data: Dict[str, Any]) -> str:
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return ''
    prompt = f"""
    사용자의 요구사항과 입력 스키마에 맞춰 timetable/sectioning 최적화 함수를 생성하세요.
    - 반드시 optimize(spec: dict, data: dict) -> dict 형태의 파이썬 함수를 반환
    - 외부 파일 접근 금지, 순수 계산만 수행
    - 출력은 data의 구조를 기반으로 타임테이블/분반 결과를 담은 dict

    요구사항:\n{requirements}\n\n입력 예시(JSON):\n{json.dumps(input_data)[:4000]}
    """
    headers = {'authorization': f'Bearer {key}', 'content-type': 'application/json'}
    body = {
        'model': os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
        'messages': [
            {'role': 'system', 'content': 'You are a strict Python code generator. Output only code for a function optimize(spec, data).'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.2,
        'response_format': {'type': 'text'},
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=body, timeout=120)
    r.raise_for_status()
    out = r.json()
    text = out['choices'][0]['message']['content']
    # Extract code fence if present
    if '```' in text:
        try:
            text = text.split('```')[1]
            if text.startswith('python'):
                text = text.split('\n', 1)[1]
        except Exception:
            pass
    return text

def run_job(j, kind: str, requirements: str, input_data: Dict[str, Any]):
    try:
        j['status'] = 'running'
        emit(j, 'progress', text='요구사항 분석 중...')

        code = ''
        try:
            code = transform_code_with_n8n(requirements, input_data)
            if code:
                emit(j, 'log', text='n8n 코드 변형 완료')
        except Exception as e:
            emit(j, 'log', text=f'n8n 코드 변형 실패, OpenAI 시도: {e}')

        if not code:
            code = transform_code_with_openai(requirements, input_data)
            if code:
                emit(j, 'log', text='OpenAI 코드 변형 완료')

        # Fallback: simple no-op function if both unavailable
        if not code:
            code = 'def optimize(spec, data):\n    return {"ok": True, "echo": data, "note": "No GPT configured"}\n'

        # Prepare exec environment
        emit(j, 'progress', text='최적화 코드 실행 중...')
        glb: Dict[str, Any] = {}
        lcl: Dict[str, Any] = {}
        exec(code, glb, lcl)  # NOTE: In production, sandboxing is recommended
        if 'optimize' not in lcl:
            raise RuntimeError('생성된 코드에 optimize 함수가 없습니다.')
        optimize = lcl['optimize']

        # Install libs as needed (optional): for heavy libs, preinstall earlier in the notebook
        # Example: import ortools (uncomment if required)
        # import subprocess, sys
        # subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', 'ortools'])

        result = optimize({'kind': kind, 'requirements': requirements}, input_data or {})
        emit(j, 'log', text='결과 생성 중...')

        # Save result to a temp file
        os.makedirs('/content/results', exist_ok=True)
        out_path = f'/content/results/{j["id"]}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        j['result_path'] = out_path
        j['status'] = 'done'
        emit(j, 'done', download_url=f'/download/{j["id"]}')
    except Exception as e:
        j['status'] = 'error'
        emit(j, 'error', message=str(e))

@app.post('/jobs')
def create_job():
    data = request.get_json(force=True, silent=True) or {}
    kind = str(data.get('kind') or 'timetable')
    requirements = str(data.get('requirements') or '')
    input_data = data.get('input') or {}
    j = new_job()
    t = threading.Thread(target=run_job, args=(j, kind, requirements, input_data), daemon=True)
    t.start()
    base = request.host_url.rstrip('/')
    return jsonify({
        'job_id': j['id'],
        'events_url': f'{base}/events/{j["id"]}',
        'status_url': f'{base}/status/{j["id"]}',
        'download_url': f'{base}/download/{j["id"]}',
    })

@app.get('/events/<job_id>')
def events(job_id: str):
    j = JOBS.get(job_id)
    if not j:
        return jsonify({'error': 'not_found'}), 404

    def gen():
        # Send a hello event
        yield f"data: {json.dumps({'type':'log','text':'connected'})}\n\n"
        # Drain existing? none. Then stream new events
        while True:
            try:
                item = j['q'].get(timeout=25)
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
                if item.get('type') == 'done':
                    break
            except queue.Empty:
                # keep connection alive
                yield f"data: {json.dumps({'type':'ping','ts':time.time()})}\n\n"
    return Response(gen(), mimetype='text/event-stream', headers={'Cache-Control': 'no-cache'})

@app.get('/status/<job_id>')
def status(job_id: str):
    j = JOBS.get(job_id)
    if not j:
        return jsonify({'error': 'not_found'}), 404
    return jsonify({'status': j.get('status'), 'download_url': f'/download/{job_id}' if j.get('result_path') else None})

@app.get('/download/<job_id>')
def download(job_id: str):
    j = JOBS.get(job_id)
    if not j or not j.get('result_path') or not os.path.exists(j['result_path']):
        return jsonify({'error': 'not_ready'}), 404
    return send_file(j['result_path'], as_attachment=True, download_name=f'{job_id}.json')

if __name__ == '__main__':
    # In Colab, expose via ngrok to get a public URL.
    # Example in notebook:
    #   !pip -q install flask flask-cors pyngrok requests
    #   from pyngrok import ngrok
    #   public_url = ngrok.connect(5000).public_url
    #   print('PUBLIC_URL=', public_url)
    #   app.run(host='0.0.0.0', port=5000)
    app.run(host='0.0.0.0', port=5000)

