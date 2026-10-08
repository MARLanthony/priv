import { http, HttpResponse } from 'msw';
import { articles, availability } from '../data';

export const nlpHandlers = [
  http.post('/api/nlp/analyze', async ({ request }) => {
    const body = await request.json() as { query: string };
    const query = body.query.toLowerCase();

    // Extract keywords from query
    const allKeywords = articles.flatMap(a => a.keywords);
    const uniqueKeywords = [...new Set(allKeywords)];
    const extractedKeywords = uniqueKeywords.filter(kw => query.includes(kw.toLowerCase()));

    // Match articles by keyword overlap
    const matchedArticles = articles
      .map(article => {
        const matchScore = article.keywords.filter(kw => query.includes(kw.toLowerCase())).length;
        return { ...article, matchScore };
      })
      .filter(a => a.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    // Determine case type and confidence
    let suggestedCaseType = 'General Legal Consultation';
    let confidence = 30;
    if (matchedArticles.length > 0) {
      suggestedCaseType = matchedArticles[0].category;
      confidence = Math.min(95, 40 + matchedArticles[0].matchScore * 20);
    }

    // Find recommended attorney
    const recommendedAttorneyName = matchedArticles.length > 0
      ? matchedArticles[0].attorneySpecialist
      : 'Intake Team';

    // Generate available slots
    const today = new Date();
    const slots = [];
    for (let i = 1; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        slots.push(
          { date: date.toISOString().split('T')[0], time: '10:00', available: true },
          { date: date.toISOString().split('T')[0], time: '14:00', available: true },
          { date: date.toISOString().split('T')[0], time: '16:00', available: i % 2 === 0 },
        );
      }
    }

    // Collect services needed
    const requiredServices = matchedArticles.length > 0
      ? [...new Set(matchedArticles.flatMap(a => a.servicesNeeded))]
      : ['Legal Consultation'];

    // Generate next steps
    const nextSteps = [
      'Schedule a consultation with the recommended attorney',
      'Gather any relevant documents and evidence',
      'Prepare a timeline of events',
      'Review the matched articles for preliminary information',
      'Bring identification and any existing legal documents to your appointment',
    ];

    const result = {
      query: body.query,
      extractedKeywords,
      suggestedCaseType,
      confidence,
      matchedArticles: matchedArticles.slice(0, 5),
      recommendedAttorney: {
        name: recommendedAttorneyName,
        specialization: suggestedCaseType,
        availableSlots: slots.filter(s => s.available),
      },
      requiredServices,
      nextSteps,
    };

    return HttpResponse.json(result);
  }),
];
