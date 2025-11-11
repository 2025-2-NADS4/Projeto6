import { useNavigate } from "react-router-dom";

export default function RoleGate(){
  const nav = useNavigate();
  return (
    <div className="gate">
      <div className="gate-hero" />
      <div className="gate-right">
        <div className="card" style={{width:360}}>
          <div className="center" style={{marginBottom:8}}>
            <img src="public/inovatech-logo.png" width="74" height="74" style={{borderRadius:999}}/>
          </div>
          <div className="subtitle">Selecione o tipo de acesso<br/>para continuar:</div>
          <div className="divider" />
          <button className="btn-pill" onClick={()=>nav('/login?role=cliente')}>ACESSO CLIENTE</button>
          <div style={{height:12}}/>
          <button className="btn-pill" onClick={()=>nav('/login?role=admin')}>ACESSO ADMINISTRADOR</button>
        </div>
      </div>
    </div>
  );
}
