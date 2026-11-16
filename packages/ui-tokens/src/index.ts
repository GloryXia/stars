// A single source for DOM custom properties and Three.js materials.
export const color = {
  void0:'#05070B', void1:'#0A0F17', void2:'#121A26', rule:'#24344A',
  ink3:'#5C6B7D', ink2:'#9AA9BA', ink1:'#E6EEF7', self:'#6FE3FF',
  selfDim:'#2C7F99', front:'#EAF2FF', thermal:'#FF8A3D', radio:'#4CF2A0',
  laser:'#FF4FA3', gw:'#A98BFF', alert:'#D96B43', dead:'#7E8A66',
  star:{O:'#9DB4FF',B:'#AABFFF',A:'#CAD8FF',F:'#FBF8FF',G:'#FFF4E8',K:'#FFDDB4',M:'#FFBD6F'}
} as const;
export const motion = {press:80,quick:160,panel:280,arrival:600} as const;
export function applyTokens(root:HTMLElement):void {
  for(const [key,value] of Object.entries(color)) if(typeof value==='string') root.style.setProperty(`--${key}`,value);
  for(const [key,value] of Object.entries(motion)) root.style.setProperty(`--motion-${key}`,`${value}ms`);
}
