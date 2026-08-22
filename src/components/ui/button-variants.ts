import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-base font-bold font-sans ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-white text-[#1A3A6B] hover:bg-white/90 shadow-md',
        primary: 'bg-white text-[#1A3A6B] hover:bg-[#FAF8F0] border border-white shadow-xl shadow-black/20 hover:shadow-2xl',
        secondary: 'bg-white/20 backdrop-blur-xl text-white border border-white/35 hover:bg-white/30 hover:border-white/50 shadow-lg',
        glassNavy: 'bg-white/85 backdrop-blur-xl text-[#1A3A6B] border border-white/50 hover:bg-white shadow-lg',
        outline: 'border border-white/40 bg-transparent text-white hover:bg-white/15',
        ghost: 'text-white hover:bg-white/15',
        link: 'text-white underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 rounded-full px-3 text-xs',
        lg: 'h-11 px-6 py-2.5 text-sm sm:text-base',
        hero: 'h-12 sm:h-[50px] px-6 sm:px-7 py-2.5 text-base sm:text-[1.05rem] font-semibold rounded-full',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
