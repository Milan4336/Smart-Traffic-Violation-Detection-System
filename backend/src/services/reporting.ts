type ViolationForReport = {
    id: string;
    type: string;
    plateNumber: string | null;
    confidenceScore: number;
    createdAt: Date;
    fineAmount: number | null;
    fineStatus: string | null;
    reviewStatus: string;
    evidenceImageUrl: string | null;
    evidenceVideoPath: string | null;
    locationLat: number | null;
    locationLng: number | null;
    cameraId: string;
    camera?: {
        name: string;
    } | null;
    vehicle?: {
        riskLevel: string;
    } | null;
};

const escapePdfText = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const splitLine = (line: string, maxLength: number): string[] => {
    if (line.length <= maxLength) {
        return [line];
    }

    const words = line.split(' ');
    const chunks: string[] = [];
    let current = '';

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxLength) {
            if (current) chunks.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) chunks.push(current);
    return chunks;
};

export const buildSimplePdf = (title: string, lines: string[]): Buffer => {
    const flattenedLines = lines.flatMap((line) => splitLine(line, 95));
    const contentLines = [
        'BT',
        '/F1 18 Tf',
        '50 790 Td',
        `(${escapePdfText(title)}) Tj`,
        '/F1 11 Tf',
        '0 -28 Td',
        ...flattenedLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, '0 -16 Td']),
        'ET'
    ];
    const content = `${contentLines.join('\n')}\n`;

    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj',
        `4 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}endstream endobj`,
        '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
    ];

    const chunks: string[] = ['%PDF-1.4\n'];
    const offsets: number[] = [0];
    let offset = Buffer.byteLength(chunks[0], 'utf8');

    for (const obj of objects) {
        offsets.push(offset);
        const chunk = `${obj}\n`;
        chunks.push(chunk);
        offset += Buffer.byteLength(chunk, 'utf8');
    }

    const xrefOffset = offset;
    const xrefHeader = `xref\n0 ${objects.length + 1}\n`;
    chunks.push(xrefHeader);
    chunks.push('0000000000 65535 f \n');

    for (let index = 1; index <= objects.length; index += 1) {
        chunks.push(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
    }

    chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return Buffer.from(chunks.join(''), 'utf8');
};

export const buildViolationReportDocument = (violation: ViolationForReport): { pdfBuffer: Buffer; filename: string } => {
    const reportLines = [
        `Violation ID: ${violation.id}`,
        `Type: ${violation.type}`,
        `Plate Number: ${violation.plateNumber || 'UNKNOWN'}`,
        `Camera: ${violation.camera?.name || violation.cameraId}`,
        `Timestamp: ${violation.createdAt.toISOString()}`,
        `Confidence: ${violation.confidenceScore.toFixed(2)}%`,
        `Review Status: ${violation.reviewStatus}`,
        `Fine Amount: INR ${violation.fineAmount || 0}`,
        `Fine Status: ${violation.fineStatus || 'pending'}`,
        `Risk Level: ${violation.vehicle?.riskLevel || 'LOW'}`,
        `Evidence Image: ${violation.evidenceImageUrl || 'N/A'}`,
        `Evidence Video: ${violation.evidenceVideoPath || 'N/A'}`,
        `Geo: ${violation.locationLat ?? 'N/A'}, ${violation.locationLng ?? 'N/A'}`
    ];

    const pdfBuffer = buildSimplePdf('Neon Guardian - Violation Evidence Report', reportLines);
    return {
        pdfBuffer,
        filename: `violation_report_${violation.id}.pdf`
    };
};
