/** Minimal owned-field model for module probes. Not a browser, trusted UA event,
 * real IME, default editing action, event propagation or HTML conformance test. */
export class FakeTextarea {
  constructor(value='') {
    this.tagName='TEXTAREA'; this.nodeName='TEXTAREA'; this.type='textarea';
    this.nodeType=1; this.isConnected=true; this.disabled=false; this.readOnly=false;
    this._value=String(value).replace(/\r\n?/g,'\n'); this.selectionStart=this._value.length;this.selectionEnd=this._value.length;
    this.selectionDirection='none';this.valueReads=0;this.blockValueRead=false;this.listeners=new Map();
    this.ownerDocument={activeElement:this,visibilityState:'visible'};
  }
  get value(){this.valueReads++;if(this.blockValueRead)throw new Error('synthetic field value must not be read');return this._value;}
  set value(value){this._value=String(value).replace(/\r\n?/g,'\n');this.selectionStart=this._value.length;this.selectionEnd=this._value.length;this.selectionDirection='none';}
  setSelectionRange(start,end,direction='none'){this.selectionStart=Math.max(0,Math.min(this._value.length,start));this.selectionEnd=Math.max(this.selectionStart,Math.min(this._value.length,end));this.selectionDirection=direction;}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  focus(){this.ownerDocument.activeElement=this;}
  blur(){this.ownerDocument.activeElement=null;}
}
export function artificialEvent(element,type,options={}){
  return {type,target:element,currentTarget:element,isTrusted:false,isComposing:false,data:null,inputType:'',key:'',code:'',repeat:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,defaultPrevented:false,
    preventDefault(){this.defaultPrevented=true;},...options};
}
export function artificialClock(){let now=0;return {read:()=>now,set(at){if(!Number.isSafeInteger(at)||at<now)throw new Error('monotonic test clock only');now=at;},get now(){return now;}};}
