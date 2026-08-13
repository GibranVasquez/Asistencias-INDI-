export default function MaintenanceScreen() {
  return <main aria-label="Sistema en mantenimiento" style={{height:"100vh",display:"grid",placeItems:"center",background:"var(--indi)",color:"var(--white)",padding:32,textAlign:"center"}}>
    <div><h1 style={{fontSize:28}}>Sistema temporalmente en mantenimiento</h1><p style={{marginTop:12,color:"var(--pastel)",lineHeight:1.6}}>No se están registrando cambios en este momento.<br/>Intenta nuevamente cuando finalice el mantenimiento.</p></div>
  </main>;
}
