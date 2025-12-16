
'use client';
import React from 'react';

function AuditDisplay({ auditText }: { auditText: string }) {
    const formatContent = (text: string) => {
        return text
            .split('\\n')
            .map((line, index) => {
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-xl font-semibold mt-6 mb-2">{line.substring(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{line.substring(3)}</h2>;
                }
                 if (line.startsWith('- **')) {
                    const boldPart = line.match(/- \\*\\*(.*?)\\*\\*/);
                    const restOfLine = line.substring(boldPart ? boldPart[0].length : 2);
                    return <p key={index} className="mt-2"><strong className="font-semibold">{boldPart ? boldPart[1] : ''}</strong>{restOfLine}</p>;
                }
                 if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4 list-disc">{line.substring(2)}</li>;
                }
                if (line.trim() === '---') {
                    return <hr key={index} className="my-6 border-dashed" />;
                }
                if (line.startsWith('|')) {
                     const isHeader = line.includes('---');
                    const cells = line.split('|').map(c => c.trim()).slice(1, -1);
                     if (isHeader) return null;
                    return (
                        <tr key={index} className="border-b">
                            {cells.map((cell, i) => <td key={i} className="p-2 align-top">{cell}</td>)}
                        </tr>
                    );
                }
                 if (line.trim() === '') {
                    return <br key={index} />;
                }
                return <p key={index}>{line}</p>;
            })
    };

    return (
        <div className="prose prose-sm sm:prose-base max-w-none">
            {formatContent(auditText)}
        </div>
    );
}

export { AuditDisplay };
