const fs = require('fs');
const path = require('path');

const viewsDir = 'c:/Users/PC/Downloads/Space.inc/space.inc/components/views';
const files = fs.readdirSync(viewsDir);

const replacements = [
    { from: /\.dueDate/g, to: '.due_date' },
    { from: /\.clientSpaceId/g, to: '.space_id' },
    { from: /\.senderType/g, to: '.sender_type' },
    { from: /\.isUnread/g, to: '.is_unread' },
    { from: /\.uploadDate/g, to: '.created_at' },
    { from: /\.assigneeId/g, to: '.assignee_id' },
    { from: /'Pending'/g, to: "'pending'" },
    { from: /"Pending"/g, to: '"pending"' },
    { from: /'In Progress'/g, to: "'in_progress'" },
    { from: /"In Progress"/g, to: '"in_progress"' },
    { from: /'Done'/g, to: "'done'" },
    { from: /"Done"/g, to: '"done"' },
    { from: /'Active'/g, to: "'active'" },
    { from: /"Active"/g, to: '"active"' },
    { from: /'Pending Invite'/g, to: "'pending'" }
];

files.forEach(file => {
    if (file.endsWith('.tsx')) {
        const filePath = path.join(viewsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        replacements.forEach(r => {
            content = content.replace(r.from, r.to);
        });

        if (content !== original) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${file}`);
        }
    }
});
