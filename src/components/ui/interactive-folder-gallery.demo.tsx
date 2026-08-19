import { InteractiveFolderGallery } from "@/components/ui/interactive-folder-gallery"

const demoDocuments = [
  { id: 1, name: "جواز السفر.pdf" },
  { id: 2, name: "عقد الإيجار.pdf" },
  { id: 3, name: "التأمين الصحي.pdf" },
  { id: 4, name: "الرقم الضريبي.jpg" },
  { id: 5, name: "تصريح الإقامة.pdf" },
]

function InteractiveFolderGalleryDemo() {
  return (
    <div className="max-w-md rounded-2xl bg-cream p-4">
      <InteractiveFolderGallery
        documents={demoDocuments}
        folderName="خزنة المستندات"
        dragHintText="اسحب أي مستند للأسفل لإغلاق"
        rtl
      />
    </div>
  )
}

export { InteractiveFolderGalleryDemo }
