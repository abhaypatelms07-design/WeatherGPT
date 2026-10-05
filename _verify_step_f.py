import urllib.request, json
try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/api/forecast?latitude=28.61&longitude=77.23&days=3', timeout=25)
    d = json.loads(r.read())
    print('FORECAST STATUS: 200 OK, days:', len(d.get('days',[])), 'location:', d.get('location'))
    if d.get('days'):
        print('day0:', d['days'][0].get('date'), d['days'][0].get('condition'))
except urllib.error.HTTPError as e:
    try:
        detail = json.loads(e.read()).get('detail','')
    except Exception:
        detail = ''
    print(f'FORECAST STATUS: {e.code}', detail)
except Exception as ex:
    print('FORECAST ERROR:', str(ex)[:150])
