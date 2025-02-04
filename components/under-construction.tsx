"use client"

import { Construction } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface UnderConstructionProps {
  pageName: string
  description: string
}

export function UnderConstruction({ pageName, description }: UnderConstructionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          {pageName}
        </h1>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>

      <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900">
        <Construction className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200 ml-2">工事中</AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300 ml-2">
          このページは現在開発中です。近日公開予定です。
        </AlertDescription>
      </Alert>
    </div>
  )
}