export function journalLayout(post) {
  return Array.isArray(post?.sections) && post.sections.some(section => section?.template === 'autumn') ? 'autumn' : 'standard'
}

export function prepareJournalSections(sections, layout) {
  return sections.filter(section => section.type === 'image' ? !!section.url : (
    (section.heading || '').trim() || (section.body || '').trim()
  )).map(section => {
    const { template: _template, ...content } = section
    return layout === 'autumn' ? { ...content, template: 'autumn' } : content
  })
}
