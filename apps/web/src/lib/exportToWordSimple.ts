import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export type ManagementReview = {
  id: string;
  title: string;
  summary: string | null;
  periodStart: string;
  periodEnd: string;
  standards: string[];
  status: 'DRAFT' | 'FINAL';
  generatedAt: string;
  createdAt: string;
  sections: ManagementReviewSection[];
};

export type ManagementReviewSection = {
  id: string;
  key: string;
  title: string;
  systemData: any;
  freeText: string | null;
  outputs: string | null;
  decisions: any;
  createdAt: string;
  updatedAt: string;
};

export type CompanySettings = {
  companyName?: string;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
};

const ISO_STANDARD_LABELS: Record<string, string> = {
  'ISO_9001': 'ISO 9001',
  'ISO_14001': 'ISO 14001',
  'ISO_45001': 'ISO 45001',
  'ISO_27001': 'ISO 27001',
  'ISO_39001': 'ISO 39001',
  'IATF_16949': 'IATF 16949',
  'ISO_50001': 'ISO 50001',
  'CUSTOM': 'Personalizado',
};

export async function exportToWord(
  review: ManagementReview,
  companySettings?: CompanySettings
): Promise<void> {
  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: companySettings?.companyName || 'SGI 360',
          bold: true,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'INFORME PARA LA DIRECCIÓN',
          bold: true,
          size: 32,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  if (companySettings?.headerText) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: companySettings.headerText,
            italics: true,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  // Report Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: review.title,
          bold: true,
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Período: ${new Date(review.periodStart).toLocaleDateString()} - ${new Date(review.periodEnd).toLocaleDateString()}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Normas: ${review.standards.map(s => ISO_STANDARD_LABELS[s] || s).join(', ')}`,
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Horizontal line
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '',
        }),
      ],
      border: {
        bottom: {
          color: '000000',
          size: 6,
          style: BorderStyle.SINGLE,
        },
      },
      spacing: { after: 400 },
    })
  );

  // Summary
  if (review.summary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'RESUMEN EJECUTIVO',
            bold: true,
            size: 24,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: review.summary,
            size: 22,
          }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  // Sections
  review.sections.forEach((section, index) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${section.title.toUpperCase()}`,
            bold: true,
            size: 24,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: index === 0 && !review.summary ? 400 : 600, after: 200 },
      })
    );

    // System Data
    if (section.systemData) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Datos del Sistema (Entradas)',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      // Format system data
      const formattedData = formatSystemData(section.systemData);
      children.push(...formattedData);
    }

    // Free Text
    if (section.freeText) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Análisis y Observaciones',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 300, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.freeText,
              size: 22,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Outputs
    if (section.outputs) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Salida Requerida',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 300, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.outputs,
              size: 22,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Decisions
    if (section.decisions) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Decisiones y Acciones',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 300, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: typeof section.decisions === 'string' 
                ? section.decisions 
                : JSON.stringify(section.decisions, null, 2),
              size: 22,
            }),
          ],
          spacing: { after: 400 },
        })
      );
    }
  });

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '',
        }),
      ],
      border: {
        top: {
          color: '000000',
          size: 6,
          style: BorderStyle.SINGLE,
        },
      },
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Informe generado el ${new Date(review.generatedAt).toLocaleDateString()}`,
          size: 20,
          italics: true,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  if (companySettings?.footerText) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: companySettings.footerText,
            size: 18,
            italics: true,
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${companySettings?.companyName || 'SGI 360'} - Sistema de Gestión Integral`,
          size: 20,
          bold: true,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = `informe-direccion-${review.title.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`;
  
  saveAs(new Blob([buffer as any]), fileName);
}

function formatSystemData(data: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (!data) return paragraphs;

  if (typeof data === 'string') {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data,
            size: 20,
          }),
        ],
        spacing: { after: 200 },
      })
    );
    return paragraphs;
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => 
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${JSON.stringify(item, null, 2)}`,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        })
      )
    );
    return paragraphs;
  }

  if (typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${key}:`,
              bold: true,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `  • Total: ${value.length}`,
                  size: 20,
                }),
              ],
              spacing: { after: 50 },
            })
          );
          
          if (value.length > 0 && typeof value[0] === 'object') {
            Object.keys(value[0]).forEach(subKey => {
              if (subKey !== 'id') {
                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `  • ${subKey}: ${value.map((v: any) => v[subKey]).join(', ')}`,
                        size: 20,
                      }),
                    ],
                    spacing: { after: 50 },
                  })
                );
              }
            });
          }
        } else {
          Object.entries(value).forEach(([subKey, subValue]) => {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `  • ${subKey}: ${String(subValue)}`,
                    size: 20,
                  }),
                ],
                spacing: { after: 50 },
              })
            );
          });
        }
      } else {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `  ${String(value)}`,
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    });
  }

  return paragraphs;
}
