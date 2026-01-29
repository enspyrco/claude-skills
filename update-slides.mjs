import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const PRESENTATION_ID = '1FeaD9hIuZ_v6JMNS37dciy7CyX6a7d0m1fT5TG0HGbs';

async function getAuth() {
  const tokenPath = path.join(homedir(), '.claude-slides', 'tokens.json');
  const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function main() {
  const auth = await getAuth();
  const slides = google.slides({ version: 'v1', auth });
  
  // Get presentation
  const pres = await slides.presentations.get({ presentationId: PRESENTATION_ID });
  const allSlides = pres.data.slides || [];
  
  console.log('Current slides:');
  for (let i = 0; i < allSlides.length; i++) {
    const slide = allSlides[i];
    let title = 'Untitled';
    for (const elem of slide.pageElements || []) {
      if (elem.shape?.text?.textElements) {
        for (const te of elem.shape.text.textElements) {
          if (te.textRun?.content?.trim()) {
            title = te.textRun.content.trim().substring(0, 40);
            break;
          }
        }
        if (title !== 'Untitled') break;
      }
    }
    console.log(`${i}: ${title}`);
  }
  
  // Find Summary slide
  let summaryIndex = -1;
  let summarySlideId = null;
  for (let i = 0; i < allSlides.length; i++) {
    const slide = allSlides[i];
    for (const elem of slide.pageElements || []) {
      if (elem.shape?.text?.textElements) {
        for (const te of elem.shape.text.textElements) {
          if (te.textRun?.content?.toLowerCase().includes('summary')) {
            summaryIndex = i;
            summarySlideId = slide.objectId;
            break;
          }
        }
      }
    }
    if (summaryIndex >= 0) break;
  }
  
  if (summaryIndex < 0) {
    console.log('Summary slide not found');
    return;
  }
  
  console.log(`\nSummary slide at index ${summaryIndex}`);
  
  if (summaryIndex < allSlides.length - 1) {
    console.log('Moving Summary to end...');
    await slides.presentations.batchUpdate({
      presentationId: PRESENTATION_ID,
      requestBody: {
        requests: [{
          updateSlidesPosition: {
            slideObjectIds: [summarySlideId],
            insertionIndex: allSlides.length
          }
        }]
      }
    });
    console.log('Moved Summary to end!');
  } else {
    console.log('Summary is already last');
  }
}

main().catch(console.error);
