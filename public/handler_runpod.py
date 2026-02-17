import runpod,torch,torchaudio,base64,os,time,subprocess
MODEL=None;MODEL_CONFIG=None
def load_model():
    global MODEL,MODEL_CONFIG
    if MODEL is not None:return MODEL,MODEL_CONFIG
    print('[SAO] Loading model...')
    ht=os.environ.get('HF_TOKEN','')
    if ht:
        os.environ['HUGGING_FACE_HUB_TOKEN']=ht
        try:
            from huggingface_hub import login
            login(token=ht)
            print('[SAO] HF login OK')
        except Exception as e:
            print(f'[SAO] HF login error: {e}')
    from stable_audio_tools import get_pretrained_model
    model,mc=get_pretrained_model('stabilityai/stable-audio-open-1.0')
    d='cuda' if torch.cuda.is_available() else 'cpu'
    model=model.to(d);MODEL=model;MODEL_CONFIG=mc
    print(f'[SAO] Model loaded on {d}')
    return model,mc
def handler(job):
    ji=job.get('input',{});prompt=ji.get('prompt','');dur=float(ji.get('duration_s',ji.get('duration',30.0)))
    neg=ji.get('negative_prompt','Low quality.');steps=int(ji.get('steps',100));cfg=float(ji.get('cfg_scale',7.0))
    sid=ji.get('song_id');fmt=ji.get('output_format','mp3')
    if not prompt:return{'error':'No prompt'}
    if dur>47:dur=47.0
    print(f'[SAO] Song:{sid} Dur:{dur}s')
    t0=time.time()
    try:
        from stable_audio_tools.inference.generation import generate_diffusion_cond
        model,mc=load_model();dev=next(model.parameters()).device
        sr=mc['sample_rate'];ss=mc['sample_size']
        c=[{'prompt':prompt,'seconds_start':0,'seconds_total':dur}]
        nc=[{'prompt':neg,'seconds_start':0,'seconds_total':dur}] if neg else None
        out=generate_diffusion_cond(model,steps=steps,cfg_scale=cfg,conditioning=c,negative_conditioning=nc,sample_size=ss,sigma_min=0.3,sigma_max=500,sampler_type='dpmpp-3m-sde',device=dev)
        out=out.squeeze(0).cpu()
        w=f'/tmp/g_{int(time.time())}.wav';m=w.replace('.wav','.mp3')
        torchaudio.save(w,out,sr)
        of=fmt
        if fmt=='mp3':
            r=subprocess.run(['ffmpeg','-i',w,'-codec:a','libmp3lame','-b:a','192k','-y',m],capture_output=True,text=True,timeout=60)
            if r.returncode!=0:m=w;of='wav'
        else:m=w;of='wav'
        with open(m,'rb') as f:b64=base64.b64encode(f.read()).decode()
        for x in[w,m]:
            try:os.remove(x)
            except:pass
        el=time.time()-t0
        print(f'[SAO] Done in {el:.1f}s')
        return{'audioBase64':b64,'audioFormat':of,'songId':sid,'durationSeconds':dur,'generationTimeSeconds':round(el,1)}
    except Exception as e:
        return{'error':str(e),'songId':sid}
runpod.serverless.start({'handler':handler})
