using FluentValidation;

namespace Quanlycongviec.Application.Features.Auth.Commands.SwitchContext
{
    public class SwitchContextCommandValidator : AbstractValidator<SwitchContextCommand>
    {
        public SwitchContextCommandValidator()
        {
            RuleFor(x => x.UserId).NotEmpty();
            RuleFor(x => x.TargetRoleCode).NotEmpty();
        }
    }
}
