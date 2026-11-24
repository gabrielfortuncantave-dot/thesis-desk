/**
 * The one-page investment memo as LaTeX, compiled to PDF by the
 * `latex-compiler/compile` integration. Pure string building, unit-tested.
 */

import { weightedScore } from './score'
import { playbookOf, type Deal, type Desk } from './types'

/** Make arbitrary text safe to place in a LaTeX document. */
export function escapeLatex(input: string): string {
  return input
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/…/g, '...')
    .replace(/€/g, 'EUR ')
    // pdflatex with T1 + utf8 covers Latin-1; anything beyond it is dropped rather than breaking the build.
    .replace(/[^\x09\x0A\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

const items = (list: string[]) => (list.length ? `\\begin{itemize}\\setlength\\itemsep{0pt}\n${list.map((i) => `\\item ${escapeLatex(i)}`).join('\n')}\n\\end{itemize}` : 'None recorded.')

export function memoLatex(deal: Deal, desk: Desk, date: string): string {
  const total = weightedScore(deal.scores ?? [], desk.criteria)
  const words = playbookOf(desk)
  const rows = desk.criteria
    .map((c) => {
      const s = (deal.scores ?? []).find((x) => x.key === c.key)
      const quote = s?.evidence?.[0]?.quote ? ` \\newline\\textit{\\footnotesize \\textquotedblleft{}${escapeLatex(s.evidence[0].quote)}\\textquotedblright{}}` : ''
      return `${escapeLatex(c.label)} & ${typeof s?.score === 'number' ? `${s.score}/10` : 'n/a'} & ${escapeLatex(s?.rationale ?? '')}${quote} \\\\ \\hline`
    })
    .join('\n')
  const p = deal.profile
  const facts = [p?.sector, p?.headquarters, p?.founded && `founded ${p.founded}`, p?.size].filter(Boolean).join(', ')
  return `\\documentclass[10pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}
\\usepackage[margin=1.6cm]{geometry}
\\usepackage{tabularx}
\\usepackage{array}
\\renewcommand{\\arraystretch}{1.35}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}
\\pagestyle{empty}
\\begin{document}
{\\LARGE\\bfseries ${escapeLatex(deal.name)}} \\hfill {\\LARGE ${total === null ? 'not scored' : `${total}/100`}}

${escapeLatex(facts)} \\hfill ${escapeLatex(words.briefTitle)}, ${escapeLatex(date)}

\\textbf{Thesis:} ${escapeLatex(desk.thesisName)}

\\section*{Summary}
${escapeLatex(deal.memo?.summary ?? '')}

\\section*{Fit with the thesis}
${escapeLatex(deal.memo?.fit ?? '')}

\\section*{Scorecard}
\\begin{tabularx}{\\textwidth}{|p{3.2cm}|c|X|}
\\hline
\\textbf{Criterion} & \\textbf{Score} & \\textbf{Rationale and evidence} \\\\ \\hline
${rows}
\\end{tabularx}

\\section*{${escapeLatex(words.forTitle)}}
${items((deal.bull ?? []).map((p) => p.point))}

\\section*{${escapeLatex(words.againstTitle)}}
${items((deal.bear ?? []).map((p) => p.point))}

\\section*{${escapeLatex(words.risksTitle)}}
${items(deal.memo?.risks ?? [])}

\\section*{${escapeLatex(words.questionsTitle)}}
${items(deal.memo?.questions ?? [])}

${deal.memo?.opener ? `\\section*{Draft first message}\n${escapeLatex(deal.memo.opener.text)}\n` : ''}
\\vfill
{\\footnotesize Generated from public sources by an AI analyst. Every quoted sentence was checked word for word against the page it cites. Scores are a screening aid, not advice. Source: ${escapeLatex(deal.websiteUrl)}}
\\end{document}
`
}
