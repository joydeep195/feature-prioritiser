const CSVHandler = (() => {
  let csvMeta = {};

  function getMeta() { return csvMeta; }

  function reset() { csvMeta = {}; }

  function parseCSVText(text) {
    if (typeof text !== 'string') {
      throw new Error('CSV content must be a string.');
    }

    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');

    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cell += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === ',') {
        row.push(cell);
        cell = '';
        continue;
      }

      if (!inQuotes && char === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    if (inQuotes) {
      throw new Error('Malformed CSV: missing closing quotation mark.');
    }

    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows.filter(row => row.some(cell => cell.trim() !== ''));
  }

  function getHeaderMap(headers) {
    const normalized = headers.map(cell => cell.trim().toLowerCase());
    const findIndex = names => normalized.findIndex(cell => names.includes(cell));

    return {
      jiraId: findIndex(['jira_id', 'jira id', 'issue key', 'key', 'jira', 'id']),
      name: findIndex(['feature name', 'summary', 'name', 'title']),
      notes: findIndex(['notes', 'comment', 'comments']),
      description: findIndex(['description', 'details']),
      acceptanceCriteria: findIndex(['acceptance criteria', 'acceptance', 'criteria']),
      storyPoints: findIndex(['story points', 'storypoints', 'story point', 'estimate', 'estimates']),
      epic: findIndex(['epic', 'epic name', 'epic link']),
      priority: findIndex(['priority', 'jira priority']),
      labels: findIndex(['labels', 'tags'])
    };
  }

  function getValue(parts, index) {
    return index >= 0 && index < parts.length ? parts[index].trim() : '';
  }

  function parseText(text) {
    const rows = parseCSVText(text);
    if (rows.length === 0) {
      throw new Error('Empty CSV content.');
    }

    const headerRow = rows[0].map(cell => cell.trim());
    const hasHeader = headerRow.some(cell => /jira|feature|summary|description|acceptance|story\s*points|epic|priority|label|notes/i.test(cell));
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const headerMap = hasHeader ? getHeaderMap(headerRow) : {
      jiraId: 0,
      name: 1,
      notes: 2,
      description: 3,
      acceptanceCriteria: 4,
      storyPoints: 5,
      epic: 6,
      priority: 7,
      labels: 8
    };

    const meta = {};
    let count = 0;

    dataRows.forEach(parts => {
      const name = getValue(parts, headerMap.name);
      if (!name) {
        return;
      }

      meta[name] = {
        jiraId: getValue(parts, headerMap.jiraId),
        notes: getValue(parts, headerMap.notes),
        description: getValue(parts, headerMap.description),
        acceptanceCriteria: getValue(parts, headerMap.acceptanceCriteria),
        storyPoints: getValue(parts, headerMap.storyPoints),
        epic: getValue(parts, headerMap.epic),
        priority: getValue(parts, headerMap.priority),
        labels: getValue(parts, headerMap.labels)
      };
      count += 1;
    });

    return { count, meta };
  }

  function parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const { count, meta } = parseText(e.target.result);
          csvMeta = meta;
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
      'PROJ-108,API access for developers,5 partner integrations waiting,As a developer I want a REST API to integrate with internal tools,"API key management, rate limiting, full CRUD on core entities, docs",21,Platform,High,"api,partnerships"'
    ].join('\n');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }));
    a.download = 'sample-backlog-rich.csv';
    a.click();
  }

  return { getMeta, reset, parse, downloadSample, parseCSVText, parseText };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVHandler;
}
