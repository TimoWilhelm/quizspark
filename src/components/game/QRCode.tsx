import React from 'react';
import QRCodeReact from 'react-qr-code';
interface QRCodeProps {
	value: string;
	size?: number;
}
export function QRCode({ value, size = 128 }: QRCodeProps) {
	return (
		<div style={{ background: 'white', padding: '16px', display: 'inline-block', borderRadius: '8px' }}>
			<QRCodeReact value={value} size={size} viewBox={`0 0 ${size} ${size}`} />
		</div>
	);
}
