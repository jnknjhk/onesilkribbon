'use client'
import { useState } from 'react'
import MediaPicker from '../../MediaPicker'
import { Card, Badge, Icon, styles as s, cx } from '../../ui'

export default function ProductImagesCard({ images, onMove, onRemove, onAdd }) {
  const [galleryOpen, setGalleryOpen] = useState(false)

  return (
    <Card title="商品图片" subtitle="第一张是主图，用箭头调整顺序。建议 1200×1200">
      <div className={s.imgGrid}>
        {images.map((url, i) => (
          <div key={`${i}-${url}`} className={cx(s.imgTile, i === 0 && s.imgTileMain)}>
            <img src={url} alt="" />
            {i === 0 && <span className={s.imgTileTag}><Badge tone="brand">主图</Badge></span>}
            <div className={s.imgTileTools}>
              <button type="button" className={s.imgTileBtn} disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="前移"><Icon name="chevronLeft" size={15} /></button>
              <button type="button" className={s.imgTileBtn} disabled={i === images.length - 1} onClick={() => onMove(i, 1)} aria-label="后移"><Icon name="chevronRight" size={15} /></button>
              <button type="button" className={s.imgTileBtn} onClick={() => onRemove(i)} aria-label="移除"><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
        <button type="button" className={s.imgAdd} onClick={() => setGalleryOpen(true)}>
          <Icon name="plus" size={22} /><span>添加图片</span>
        </button>
      </div>
      <MediaPicker open={galleryOpen} multiple namespace="product" onClose={() => setGalleryOpen(false)} onSelect={onAdd} />
    </Card>
  )
}
