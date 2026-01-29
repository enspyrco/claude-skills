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
  
  // Find Summary slide (now last)
  const summarySlide = allSlides[allSlides.length - 1];
  console.log('Last slide (Summary):', summarySlide.objectId);
  
  // Find all text elements to see current content
  const textElements = [];
  for (const elem of summarySlide.pageElements || []) {
    if (elem.shape?.text?.textElements) {
      let fullText = '';
      for (const te of elem.shape.text.textElements) {
        if (te.textRun?.content) {
          fullText += te.textRun.content;
        }
      }
      if (fullText.trim()) {
        textElements.push({
          id: elem.objectId,
          text: fullText.trim()
        });
        console.log(`Element ${elem.objectId}: "${fullText.trim().substring(0, 50)}..."`);
      }
    }
  }
  
  // Find the bullet points element (the one with multiple lines/bullets)
  const bulletElement = textElements.find(e => 
    e.text.includes('•') || e.text.includes('\n') || e.text.toLowerCase().includes('terraform')
  );
  
  if (bulletElement) {
    console.log('\nUpdating bullet points to include backup & restore...');
    
    // Delete existing text and replace
    const requests = [
      {
        deleteText: {
          objectId: bulletElement.id,
          textRange: { type: 'ALL' }
        }
      },
      {
        insertText: {
          objectId: bulletElement.id,
          text: '• Infrastructure as Code with Terraform\n• Encrypted secrets with SOPS + age\n• Automated deployments via make deploy\n• Daily backups to OCI Object Storage\n• Auto-restore on fresh deploy\n• Disaster recovery: make apply && make deploy',
          insertionIndex: 0
        }
      }
    ];
    
    await slides.presentations.batchUpdate({
      presentationId: PRESENTATION_ID,
      requestBody: { requests }
    });
    
    console.log('Updated Summary with backup & restore!');
  } else {
    console.log('Could not find bullet points element');
  }
}

main().catch(console.error);
