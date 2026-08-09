(function(global){
  function equipmentDisplayName(e){return `${e?.manufacturer||''} ${e?.model||''}`.trim()||e?.type||'Įranga nenurodyta';}
  function normalizeEquipmentName(value){return String(value||'').trim().toLocaleLowerCase('lt-LT').replace(/\s+/g,' ');}
  function clientInstallations(c){return (c.properties||[]).flatMap(p=>(p.equipment||[]).map(e=>({c,p,e})));}
  function resolveServiceContext(c,service){
    const installations=clientInstallations(c);
    if(service.equipmentId){
      const explicit=installations.find(({e})=>e.id===service.equipmentId);
      return explicit?{...explicit,resolution:'explicit'}:null;
    }
    const propertyCandidates=service.propertyId?installations.filter(({p})=>p.id===service.propertyId):installations;
    const serviceName=normalizeEquipmentName(service.equipmentName);
    const nameMatches=serviceName?propertyCandidates.filter(({e})=>normalizeEquipmentName(equipmentDisplayName(e))===serviceName):[];
    if(nameMatches.length===1)return {...nameMatches[0],resolution:'legacy-name'};
    if(propertyCandidates.length===1)return {...propertyCandidates[0],resolution:'legacy-single'};
    if(nameMatches.length>1)return {...nameMatches[0],resolution:'legacy-ambiguous'};
    return propertyCandidates[0]?{...propertyCandidates[0],resolution:'legacy-primary'}:null;
  }
  function servicesForEquipment(c,p,e){return (c.services||[]).filter(service=>{
    if(service.equipmentId)return service.equipmentId===e.id;
    const context=resolveServiceContext(c,service);
    return context?.p.id===p.id&&context?.e.id===e.id;
  });}
  function validCoordinates(item){
    const latitude=Number(item?.latitude),longitude=Number(item?.longitude);
    return item?.latitude!==null&&item?.latitude!==''&&item?.latitude!==undefined&&item?.longitude!==null&&item?.longitude!==''&&item?.longitude!==undefined&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
  }
  function mapUrl(item,provider){
    const hasCoordinates=validCoordinates(item);
    const destination=hasCoordinates?`${Number(item.latitude)},${Number(item.longitude)}`:String(item?.address||'').trim();
    if(!destination)return '';
    const params=new URLSearchParams();
    if(provider==='Waze'){
      params.set(hasCoordinates?'ll':'q',destination);
      params.set('navigate','yes');
      return `https://www.waze.com/ul?${params.toString()}`;
    }
    params.set('api','1');
    params.set('query',destination);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  global.AirHeatDomain={equipmentDisplayName,normalizeEquipmentName,clientInstallations,resolveServiceContext,servicesForEquipment,validCoordinates,mapUrl};
})(window);
