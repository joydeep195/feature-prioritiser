const CSVHandler = (() => {
  let csvMeta = {};

  function getMeta() { return csvMeta; }

  function reset() { csvMeta = {}; }

  function parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const lines = e.target.result.split('\n').filter(l => l.trim());
          if (lines.length === 0) return reject('Empty file.');

          const headerLine = lines[0].toLowerCase();
          const hasHeader = headerLine.includes('jira') || headerLine.includes('feature') || headerLine.includes('summary');
          const startIdx = hasHeader ? 1 : 0;

          csvMeta = {};
          let count = 0;

          lines.slice(startIdx).forEach(line => {
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
            const jiraId             = parts[0] || '';
            const name               = parts[1] || '';
            const notes              = parts[2] || '';
            const description        = parts[3] || '';
            const acceptanceCriteria = parts[4] || '';
            const storyPoints        = parts[5] || '';
            const epic               = parts[6] || '';
            const priority           = parts[7] || '';
            const labels             = parts[8] || '';

            if (name) {
              csvMeta[name] = { jiraId, notes, description, acceptanceCriteria, storyPoints, epic, priority, labels };
              count++;
            }
          });

          resolve({ count, fileName: file.name });
        } catch (err) {
          reject(err.message);
        }
      };
      reader.onerror = () => reject('Failed to read file.');
      reader.readAsText(file);
    });
  }

  function downloadSample() {
    const sample = [
      'JIRA_ID,Feature Name,Notes,Description,Acceptance Criteria,Story Points,Epic,Priority,Labels',
      'PROJ-101,Dark mode for mobile app,340+ user requests,As a user I want a dark theme to reduce eye strain at night,"Theme toggle in settings, persists across sessions, covers all screens",5,User Experience,High,"ux,accessibility"',
      'PROJ-102,Bulk export to CSV,Blocker for 3 enterprise deals,As an admin I want to export all data to CSV for reporting,"Export button on dashboard, includes all fields, max 10000 rows",8,Data & Reporting,Critical,"enterprise,reporting"',
      'PROJ-103,Onboarding checklist for new users,Activation rate down 12%,As a new user I want a guided checklist to discover core features,"Checklist on first login, tracks completion, dismissable, 5 key actions",3,Growth,High,"onboarding,activation"',
      'PROJ-104,Password reset via email,200+ support tickets per month,As a user I want to reset my password via email,"Reset link sent within 60s, expires in 1 hour, works on all email clients",2,Core Auth,Critical,"auth,support-reduction"',
      'PROJ-105,In-app push notifications,Marketing re-engagement blocked,As a user I want to receive relevant in-app alerts,"Permission prompt on first login, notification centre, mark as read",13,Engagement,Medium,"engagement,marketing"',
      'PROJ-106,Advanced search and filters,Top enterprise request,As a power user I want to filter results by multiple criteria,"Filter by date, status, owner, tag. Filters persist. Results update instantly",8,Search,High,"enterprise,power-users"',
      'PROJ-107,Two-factor authentication,Compliance requirement,As an admin I want to enforce 2FA for security compliance,"TOTP support, SMS fallback, recovery codes, admin enforcement toggle",5,Security,Critical,"security,compliance"',
      'PROJ-108,API access for developers,5 partner integrations waiting,As a developer I want a REST API to integrate with internal tools,"API key management, rate limiting, full CRUD on core entities, docs",21,Platform,High,"api,partnerships"',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }));
    a.download = 'sample-backlog-rich.csv';
    a.click();
  }

  return { getMeta, reset, parse, downloadSample };
})();