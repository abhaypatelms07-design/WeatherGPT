import urllib.request, json
try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/api/alerts?latitude=28.61&longitude=77.23', timeout=25)
    d = json.loads(r.read())
    print('ALERTS STATUS: 200 OK, has_alert:', d.get('has_alert'), 'severity:', d.get('severity'))
except urllib.error.HTTPError as e:
    try:
        detail = json.loads(e.read()).get('detail','')
    except Exception:
        detail = ''
    print(f'ALERTS STATUS: {e.code}', detail)
except Exception as ex:
    print('ALERTS ERROR:', str(ex)[:150])
